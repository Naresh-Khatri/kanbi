import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { isDoneLikeColumn } from "@/lib/column-heuristics";
import { positionAtEnd, positionBetween } from "@/lib/position";
import { recordActivity } from "@/server/activity/record";
import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import { boardColumn, task, taskPriority } from "@/server/db/schema";
import { createNotifications } from "@/server/notifications/create";
import { resolveMentions } from "@/server/notifications/mentions";
import { bus } from "@/server/realtime/bus";

const priorityEnum = z.enum(taskPriority.enumValues);

export const taskRouter = createTRPCRouter({
  create: boardProcedure
    .input(
      z.object({
        columnId: z.string().min(1),
        title: z.string().min(1).max(200),
        description: z.string().max(10_000).optional(),
        priority: priorityEnum.optional(),
        assigneeId: z.string().nullable().optional(),
        dueAt: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);

      const col = await ctx.db
        .select({ id: boardColumn.id, boardId: boardColumn.boardId })
        .from(boardColumn)
        .where(eq(boardColumn.id, input.columnId))
        .limit(1);
      if (!col[0] || col[0].boardId !== input.boardId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const existing = await ctx.db
        .select({ position: task.position })
        .from(task)
        .where(eq(task.columnId, input.columnId))
        .orderBy(asc(task.position));

      const [row] = await ctx.db
        .insert(task)
        .values({
          boardId: input.boardId,
          columnId: input.columnId,
          title: input.title,
          description: input.description,
          priority: input.priority ?? "none",
          position: positionAtEnd(existing),
          reporterId: ctx.session.user.id,
          assigneeId: input.assigneeId ?? null,
          dueAt: input.dueAt ?? null,
        })
        .returning();
      bus.emitBoard(input.boardId, { scope: "task", ids: row ? [row.id] : [] });
      if (row) {
        await recordActivity(ctx.db, {
          boardId: input.boardId,
          taskId: row.id,
          actorId: ctx.session.user.id,
          verb: "task.created",
          payload: { title: row.title },
        });
        const pending: Parameters<typeof createNotifications>[1] = [];
        if (row.assigneeId) {
          pending.push({
            userId: row.assigneeId,
            actorId: ctx.session.user.id,
            type: "task.assigned",
            boardId: input.boardId,
            taskId: row.id,
            data: { title: row.title },
          });
        }
        if (row.description) {
          const mentioned = await resolveMentions(
            ctx.db,
            input.boardId,
            row.description,
          );
          for (const userId of mentioned) {
            if (userId === row.assigneeId) continue;
            pending.push({
              userId,
              actorId: ctx.session.user.id,
              type: "task.mention",
              boardId: input.boardId,
              taskId: row.id,
              data: { title: row.title },
            });
          }
        }
        if (pending.length > 0) await createNotifications(ctx.db, pending);
      }
      return row;
    }),

  update: boardProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(10_000).nullable().optional(),
        priority: priorityEnum.optional(),
        assigneeId: z.string().nullable().optional(),
        dueAt: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const { taskId, boardId, ...rest } = input;

      const existingRows = await ctx.db
        .select({
          assigneeId: task.assigneeId,
          title: task.title,
          description: task.description,
        })
        .from(task)
        .where(and(eq(task.id, taskId), eq(task.boardId, boardId)))
        .limit(1);
      const previous = existingRows[0];

      await ctx.db
        .update(task)
        .set(rest)
        .where(and(eq(task.id, taskId), eq(task.boardId, boardId)));
      bus.emitBoard(boardId, { scope: "task", ids: [taskId] });
      await recordActivity(ctx.db, {
        boardId,
        taskId,
        actorId: ctx.session.user.id,
        verb: "task.updated",
        payload: { fields: Object.keys(rest) },
      });

      if (
        "assigneeId" in rest &&
        previous &&
        rest.assigneeId !== previous.assigneeId
      ) {
        const title = rest.title ?? previous.title;
        const pending = [] as Parameters<typeof createNotifications>[1];
        if (previous.assigneeId) {
          pending.push({
            userId: previous.assigneeId,
            actorId: ctx.session.user.id,
            type: "task.unassigned",
            boardId,
            taskId,
            data: { title },
          });
        }
        if (rest.assigneeId) {
          pending.push({
            userId: rest.assigneeId,
            actorId: ctx.session.user.id,
            type: "task.assigned",
            boardId,
            taskId,
            data: { title },
          });
        }
        if (pending.length > 0) await createNotifications(ctx.db, pending);
      }

      if ("description" in rest && previous && rest.description) {
        const before = new Set(
          await resolveMentions(ctx.db, boardId, previous.description ?? ""),
        );
        const after = await resolveMentions(ctx.db, boardId, rest.description);
        const newly = after.filter((id) => !before.has(id));
        if (newly.length > 0) {
          await createNotifications(
            ctx.db,
            newly.map((userId) => ({
              userId,
              actorId: ctx.session.user.id,
              type: "task.mention" as const,
              boardId,
              taskId,
              data: { title: rest.title ?? previous.title },
            })),
          );
        }
      }
    }),

  delete: boardProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .delete(task)
        .where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)));
      bus.emitBoard(input.boardId, { scope: "task", ids: [input.taskId] });
    }),

  move: boardProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        toColumnId: z.string().min(1),
        before: z.number().nullable(),
        after: z.number().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const col = await ctx.db
        .select({ boardId: boardColumn.boardId, name: boardColumn.name })
        .from(boardColumn)
        .where(eq(boardColumn.id, input.toColumnId))
        .limit(1);
      if (!col[0] || col[0].boardId !== input.boardId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const existing = await ctx.db
        .select({
          columnId: task.columnId,
          title: task.title,
          reporterId: task.reporterId,
          assigneeId: task.assigneeId,
        })
        .from(task)
        .where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)))
        .limit(1);
      const prev = existing[0];

      await ctx.db
        .update(task)
        .set({
          columnId: input.toColumnId,
          position: positionBetween(input.before, input.after),
        })
        .where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)));
      bus.emitBoard(input.boardId, { scope: "task", ids: [input.taskId] });
      await recordActivity(ctx.db, {
        boardId: input.boardId,
        taskId: input.taskId,
        actorId: ctx.session.user.id,
        verb: "task.moved",
        payload: { toColumnId: input.toColumnId },
      });

      const target = col[0];
      if (
        prev &&
        target &&
        prev.columnId !== input.toColumnId &&
        isDoneLikeColumn(target.name)
      ) {
        const recipients = new Set<string>();
        if (prev.reporterId) recipients.add(prev.reporterId);
        if (prev.assigneeId) recipients.add(prev.assigneeId);
        recipients.delete(ctx.session.user.id);
        if (recipients.size > 0) {
          await createNotifications(
            ctx.db,
            [...recipients].map((userId) => ({
              userId,
              actorId: ctx.session.user.id,
              type: "task.moved_to_done" as const,
              boardId: input.boardId,
              taskId: input.taskId,
              data: { title: prev.title, columnName: target.name },
            })),
          );
        }
      }
    }),

  archive: boardProcedure
    .input(z.object({ taskId: z.string().min(1), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .update(task)
        .set({ archivedAt: input.archived ? new Date() : null })
        .where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)));
      bus.emitBoard(input.boardId, { scope: "task", ids: [input.taskId] });
    }),
});
