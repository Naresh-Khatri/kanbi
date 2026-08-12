import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { POSITION_STEP, positionAtEnd, positionBetween } from "@/lib/position";
import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import { boardColumn, task } from "@/server/db/schema";
import { bus } from "@/server/realtime/bus";

export const columnRouter = createTRPCRouter({
  create: boardProcedure
    .input(z.object({ name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const existing = await ctx.db
        .select({ position: boardColumn.position })
        .from(boardColumn)
        .where(eq(boardColumn.boardId, input.boardId))
        .orderBy(asc(boardColumn.position));

      const [row] = await ctx.db
        .insert(boardColumn)
        .values({
          boardId: input.boardId,
          name: input.name,
          position: positionAtEnd(existing),
        })
        .returning();
      bus.emitBoard(input.boardId, {
        scope: "column",
        ids: row ? [row.id] : [],
      });
      return row;
    }),

  rename: boardProcedure
    .input(
      z.object({
        columnId: z.string().min(1),
        name: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .update(boardColumn)
        .set({ name: input.name })
        .where(eq(boardColumn.id, input.columnId));
      bus.emitBoard(input.boardId, {
        scope: "column",
        ids: [input.columnId],
      });
    }),

  setSort: boardProcedure
    .input(
      z.object({
        columnId: z.string().min(1),
        sortMode: z.enum([
          "manual",
          "priority",
          "assignee",
          "dueAt",
          "createdAt",
        ]),
        sortDir: z.enum(["asc", "desc"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const existing = await ctx.db
        .select({ id: boardColumn.id, boardId: boardColumn.boardId })
        .from(boardColumn)
        .where(eq(boardColumn.id, input.columnId))
        .limit(1);
      const hit = existing[0];
      if (!hit || hit.boardId !== input.boardId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.db
        .update(boardColumn)
        .set({ sortMode: input.sortMode, sortDir: input.sortDir })
        .where(eq(boardColumn.id, input.columnId));
      bus.emitBoard(input.boardId, {
        scope: "column",
        ids: [input.columnId],
      });
    }),

  setWipLimit: boardProcedure
    .input(
      z.object({
        columnId: z.string().min(1),
        wipLimit: z.number().int().min(1).max(999).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const [updated] = await ctx.db
        .update(boardColumn)
        .set({ wipLimit: input.wipLimit })
        .where(
          and(
            eq(boardColumn.id, input.columnId),
            eq(boardColumn.boardId, input.boardId),
          ),
        )
        .returning({ id: boardColumn.id });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      bus.emitBoard(input.boardId, {
        scope: "column",
        ids: [input.columnId],
      });
    }),

  setCategory: boardProcedure
    .input(
      z.object({
        columnId: z.string().min(1),
        category: z.enum([
          "backlog",
          "unstarted",
          "started",
          "completed",
          "canceled",
        ]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const [updated] = await ctx.db
        .update(boardColumn)
        .set({ category: input.category })
        .where(
          and(
            eq(boardColumn.id, input.columnId),
            eq(boardColumn.boardId, input.boardId),
          ),
        )
        .returning({ id: boardColumn.id });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      bus.emitBoard(input.boardId, {
        scope: "column",
        ids: [input.columnId],
      });
    }),

  reorder: boardProcedure
    .input(
      z.object({
        columnId: z.string().min(1),
        before: z.number().nullable(),
        after: z.number().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .update(boardColumn)
        .set({ position: positionBetween(input.before, input.after) })
        .where(eq(boardColumn.id, input.columnId));
      bus.emitBoard(input.boardId, {
        scope: "column",
        ids: [input.columnId],
      });
    }),

  delete: boardProcedure
    .input(
      z.object({
        columnId: z.string().min(1),
        moveTasksToColumnId: z.string().min(1).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db.transaction(async (tx) => {
        const columns = await tx
          .select({ id: boardColumn.id })
          .from(boardColumn)
          .where(eq(boardColumn.boardId, input.boardId))
          .for("update");
        if (!columns.some((column) => column.id === input.columnId)) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        if (columns.length <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A board must have at least one column.",
          });
        }

        const sourceTasks = await tx
          .select({ id: task.id })
          .from(task)
          .where(
            and(
              eq(task.boardId, input.boardId),
              eq(task.columnId, input.columnId),
            ),
          )
          .orderBy(asc(task.position));

        if (sourceTasks.length > 0) {
          const destinationId = input.moveTasksToColumnId;
          if (
            !destinationId ||
            destinationId === input.columnId ||
            !columns.some((column) => column.id === destinationId)
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Choose another column for these tasks.",
            });
          }

          const destinationTasks = await tx
            .select({ position: task.position })
            .from(task)
            .where(
              and(
                eq(task.boardId, input.boardId),
                eq(task.columnId, destinationId),
              ),
            )
            .orderBy(asc(task.position));
          const firstPosition = positionAtEnd(destinationTasks);

          for (const [index, sourceTask] of sourceTasks.entries()) {
            await tx
              .update(task)
              .set({
                columnId: destinationId,
                position: firstPosition + index * POSITION_STEP,
              })
              .where(
                and(
                  eq(task.id, sourceTask.id),
                  eq(task.boardId, input.boardId),
                ),
              );
          }
        }

        await tx
          .delete(boardColumn)
          .where(
            and(
              eq(boardColumn.id, input.columnId),
              eq(boardColumn.boardId, input.boardId),
            ),
          );
      });
      bus.emitBoard(input.boardId, {
        scope: "column",
        ids: [input.columnId],
      });
    }),
});
