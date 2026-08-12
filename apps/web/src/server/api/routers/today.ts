import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";

import { isDoneLikeColumn } from "@/lib/column-heuristics";
import { positionAtEnd } from "@/lib/position";
import { resolveBoardAccess } from "@/server/api/permissions";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  board,
  boardColumn,
  project,
  task,
  todayItem,
} from "@/server/db/schema";

export const todayRouter = createTRPCRouter({
  // Cross-project working queue: the caller's picks, joined with enough task
  // + project context to render a row and link to the board.
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        taskId: todayItem.taskId,
        addedAt: todayItem.addedAt,
        title: task.title,
        priority: task.priority,
        estimatePomodoros: task.estimatePomodoros,
        columnId: task.columnId,
        number: task.number,
        columnName: boardColumn.name,
        projectSlug: project.slug,
        projectName: project.name,
        projectKey: project.key,
      })
      .from(todayItem)
      .innerJoin(task, eq(task.id, todayItem.taskId))
      .innerJoin(boardColumn, eq(boardColumn.id, task.columnId))
      .innerJoin(board, eq(board.id, task.boardId))
      .innerJoin(project, eq(project.id, board.projectId))
      .where(
        and(
          eq(todayItem.userId, ctx.session.user.id),
          isNull(task.archivedAt),
          ne(project.status, "archived"),
        ),
      )
      .orderBy(asc(todayItem.position));
  }),

  // Lightweight membership check for card/sheet toggles — avoids pulling the
  // full joined row set just to know "is this task in today?".
  ids: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ taskId: todayItem.taskId })
      .from(todayItem)
      .where(eq(todayItem.userId, ctx.session.user.id));
    return rows.map((r) => r.taskId);
  }),

  add: protectedProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const taskRow = await ctx.db
        .select({ boardId: task.boardId })
        .from(task)
        .where(eq(task.id, input.taskId))
        .limit(1);
      if (!taskRow[0]) throw new TRPCError({ code: "NOT_FOUND" });
      // Throws NOT_FOUND/FORBIDDEN if the caller can't reach this board.
      await resolveBoardAccess({ db: ctx.db, userId, boardId: taskRow[0].boardId });

      const existing = await ctx.db
        .select({ position: todayItem.position })
        .from(todayItem)
        .where(eq(todayItem.userId, userId))
        .orderBy(asc(todayItem.position));

      await ctx.db
        .insert(todayItem)
        .values({
          userId,
          taskId: input.taskId,
          position: positionAtEnd(existing),
        })
        .onConflictDoNothing();
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(todayItem)
        .where(
          and(
            eq(todayItem.userId, ctx.session.user.id),
            eq(todayItem.taskId, input.taskId),
          ),
        );
      return { ok: true };
    }),

  clearDone: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const rows = await ctx.db
      .select({
        taskId: todayItem.taskId,
        archivedAt: task.archivedAt,
        columnName: boardColumn.name,
      })
      .from(todayItem)
      .innerJoin(task, eq(task.id, todayItem.taskId))
      .innerJoin(boardColumn, eq(boardColumn.id, task.columnId))
      .where(eq(todayItem.userId, userId));

    const doneIds = rows
      .filter((r) => r.archivedAt !== null || isDoneLikeColumn(r.columnName))
      .map((r) => r.taskId);
    if (doneIds.length === 0) return { removed: 0 };

    await ctx.db
      .delete(todayItem)
      .where(
        and(eq(todayItem.userId, userId), inArray(todayItem.taskId, doneIds)),
      );
    return { removed: doneIds.length };
  }),
});
