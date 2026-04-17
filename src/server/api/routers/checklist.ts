import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { positionAtEnd } from "@/lib/position";
import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import type { db as Db } from "@/server/db";
import { checklistItem, task } from "@/server/db/schema";
import { createNotifications } from "@/server/notifications/create";
import { bus } from "@/server/realtime/bus";

async function assertTaskOnBoard(
  db: typeof Db,
  taskId: string,
  boardId: string,
) {
  const row = await db
    .select({ boardId: task.boardId })
    .from(task)
    .where(eq(task.id, taskId))
    .limit(1);
  if (!row[0] || row[0].boardId !== boardId) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
}

export const checklistRouter = createTRPCRouter({
  list: boardProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertTaskOnBoard(ctx.db, input.taskId, input.boardId);
      return ctx.db
        .select()
        .from(checklistItem)
        .where(eq(checklistItem.taskId, input.taskId))
        .orderBy(asc(checklistItem.position));
    }),

  add: boardProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        text: z.string().min(1).max(280),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await assertTaskOnBoard(ctx.db, input.taskId, input.boardId);
      const existing = await ctx.db
        .select({ position: checklistItem.position })
        .from(checklistItem)
        .where(eq(checklistItem.taskId, input.taskId))
        .orderBy(asc(checklistItem.position));
      const [row] = await ctx.db
        .insert(checklistItem)
        .values({
          taskId: input.taskId,
          text: input.text,
          position: positionAtEnd(existing),
        })
        .returning();
      bus.emitBoard(input.boardId, {
        scope: "checklist",
        ids: [input.taskId],
      });
      return row;
    }),

  toggle: boardProcedure
    .input(z.object({ itemId: z.string().min(1), done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .update(checklistItem)
        .set({ done: input.done })
        .where(eq(checklistItem.id, input.itemId));
      bus.emitBoard(input.boardId, { scope: "checklist", ids: [input.itemId] });

      if (!input.done) return;

      const itemRow = await ctx.db
        .select({ taskId: checklistItem.taskId })
        .from(checklistItem)
        .where(eq(checklistItem.id, input.itemId))
        .limit(1);
      const taskId = itemRow[0]?.taskId;
      if (!taskId) return;

      const items = await ctx.db
        .select({ done: checklistItem.done })
        .from(checklistItem)
        .where(eq(checklistItem.taskId, taskId));
      if (items.length === 0 || items.some((i) => !i.done)) return;

      const taskRows = await ctx.db
        .select({
          title: task.title,
          reporterId: task.reporterId,
          assigneeId: task.assigneeId,
        })
        .from(task)
        .where(eq(task.id, taskId))
        .limit(1);
      const t = taskRows[0];
      if (!t) return;

      const recipients = new Set<string>();
      if (t.reporterId) recipients.add(t.reporterId);
      if (t.assigneeId) recipients.add(t.assigneeId);
      recipients.delete(ctx.session.user.id);
      if (recipients.size === 0) return;

      await createNotifications(
        ctx.db,
        [...recipients].map((userId) => ({
          userId,
          actorId: ctx.session.user.id,
          type: "task.checklist_completed" as const,
          boardId: input.boardId,
          taskId,
          data: { title: t.title, itemCount: items.length },
        })),
      );
    }),

  rename: boardProcedure
    .input(
      z.object({
        itemId: z.string().min(1),
        text: z.string().min(1).max(280),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .update(checklistItem)
        .set({ text: input.text })
        .where(eq(checklistItem.id, input.itemId));
      bus.emitBoard(input.boardId, { scope: "checklist", ids: [input.itemId] });
    }),

  remove: boardProcedure
    .input(z.object({ itemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .delete(checklistItem)
        .where(eq(checklistItem.id, input.itemId));
      bus.emitBoard(input.boardId, { scope: "checklist", ids: [input.itemId] });
    }),
});
