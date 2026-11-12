import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { shareToken } from "@/lib/ids";
import {
  assertCanAdmin,
  boardProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import {
  board,
  boardColumn,
  boardShare,
  checklistItem,
  label,
  project,
  task,
  taskLabel,
  user,
} from "@/server/db/schema";

export const shareRouter = createTRPCRouter({
  list: boardProcedure.query(({ ctx, input }) =>
    ctx.db
      .select()
      .from(boardShare)
      .where(
        and(
          eq(boardShare.boardId, input.boardId),
          isNull(boardShare.revokedAt),
        ),
      )
      .orderBy(desc(boardShare.createdAt)),
  ),

  create: boardProcedure
    .input(
      z.object({
        expiresAt: z.date().nullable().optional(),
        maxUses: z.number().int().positive().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanAdmin(ctx.access);
      const [row] = await ctx.db
        .insert(boardShare)
        .values({
          boardId: input.boardId,
          token: shareToken(),
          createdById: ctx.session.user.id,
          expiresAt: input.expiresAt ?? null,
          maxUses: input.maxUses ?? null,
        })
        .returning();
      return row;
    }),

  getPublic: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const share = await ctx.db
        .select({
          id: boardShare.id,
          boardId: boardShare.boardId,
          expiresAt: boardShare.expiresAt,
          revokedAt: boardShare.revokedAt,
          maxUses: boardShare.maxUses,
          usesCount: boardShare.usesCount,
        })
        .from(boardShare)
        .where(eq(boardShare.token, input.token))
        .limit(1);
      const hit = share[0];
      if (!hit) return { status: "not_found" as const };
      if (hit.revokedAt) return { status: "revoked" as const };
      if (hit.expiresAt && hit.expiresAt <= now) {
        return { status: "expired" as const };
      }
      if (hit.maxUses != null && hit.usesCount >= hit.maxUses) {
        return { status: "exhausted" as const };
      }

      const boardRow = await ctx.db
        .select({
          id: board.id,
          projectName: project.name,
          projectDescription: project.description,
          projectKey: project.key,
          projectColor: project.color,
        })
        .from(board)
        .innerJoin(project, eq(project.id, board.projectId))
        .where(eq(board.id, hit.boardId))
        .limit(1);
      if (!boardRow[0]) return { status: "not_found" as const };

      // explicit public allowlist: no emails, reporter, estimates or archived work
      const [columns, tasks, labels, taskLabels, checklist, assignees] =
        await Promise.all([
          ctx.db
            .select({
              id: boardColumn.id,
              name: boardColumn.name,
              color: boardColumn.color,
              category: boardColumn.category,
            })
            .from(boardColumn)
            .where(eq(boardColumn.boardId, hit.boardId))
            .orderBy(asc(boardColumn.position)),
          ctx.db
            .select({
              id: task.id,
              columnId: task.columnId,
              number: task.number,
              title: task.title,
              description: task.description,
              priority: task.priority,
              assigneeId: task.assigneeId,
              dueAt: task.dueAt,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
            })
            .from(task)
            .where(and(eq(task.boardId, hit.boardId), isNull(task.archivedAt)))
            .orderBy(asc(task.position)),
          ctx.db
            .select({ id: label.id, name: label.name, color: label.color })
            .from(label)
            .where(eq(label.boardId, hit.boardId)),
          ctx.db
            .select({ taskId: taskLabel.taskId, labelId: taskLabel.labelId })
            .from(taskLabel)
            .innerJoin(task, eq(task.id, taskLabel.taskId))
            .where(and(eq(task.boardId, hit.boardId), isNull(task.archivedAt))),
          ctx.db
            .select({
              id: checklistItem.id,
              taskId: checklistItem.taskId,
              text: checklistItem.text,
              done: checklistItem.done,
            })
            .from(checklistItem)
            .innerJoin(task, eq(task.id, checklistItem.taskId))
            .where(and(eq(task.boardId, hit.boardId), isNull(task.archivedAt)))
            .orderBy(asc(checklistItem.position)),
          ctx.db
            .selectDistinct({ id: user.id, name: user.name, image: user.image })
            .from(user)
            .innerJoin(task, eq(task.assigneeId, user.id))
            .where(and(eq(task.boardId, hit.boardId), isNull(task.archivedAt))),
        ]);

      const updatedAt = tasks.reduce<Date | null>(
        (max, t) =>
          t.updatedAt && (!max || t.updatedAt > max) ? t.updatedAt : max,
        null,
      );

      return {
        status: "ok" as const,
        board: boardRow[0],
        expiresAt: hit.expiresAt,
        updatedAt,
        columns,
        tasks,
        labels,
        taskLabels,
        checklist,
        // first name only - public page shouldn't publish full names
        assignees: assignees.map((a) => ({
          id: a.id,
          name: a.name.trim().split(/\s+/)[0] ?? "",
          image: a.image,
        })),
      };
    }),

  // Count one view, atomically and only while the link is still valid. The
  // `usesCount < maxUses` guard caps the counter so the visitor who consumes
  // the final use isn't blocked, and prevents over-counting past the limit.
  recordView: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      await ctx.db
        .update(boardShare)
        .set({ usesCount: sql`${boardShare.usesCount} + 1` })
        .where(
          and(
            eq(boardShare.token, input.token),
            isNull(boardShare.revokedAt),
            or(isNull(boardShare.expiresAt), gt(boardShare.expiresAt, now)),
            or(
              isNull(boardShare.maxUses),
              sql`${boardShare.usesCount} < ${boardShare.maxUses}`,
            ),
          ),
        );
    }),

  revoke: boardProcedure
    .input(z.object({ shareId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertCanAdmin(ctx.access);
      const row = await ctx.db
        .select({ id: boardShare.id, boardId: boardShare.boardId })
        .from(boardShare)
        .where(eq(boardShare.id, input.shareId))
        .limit(1);
      if (!row[0] || row[0].boardId !== input.boardId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.db
        .update(boardShare)
        .set({ revokedAt: new Date() })
        .where(eq(boardShare.id, input.shareId));
    }),
});
