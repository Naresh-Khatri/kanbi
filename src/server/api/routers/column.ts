import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { positionAtEnd, positionBetween } from "@/lib/position";
import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import { boardColumn } from "@/server/db/schema";
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
    .input(z.object({ columnId: z.string().min(1) }))
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
        .delete(boardColumn)
        .where(eq(boardColumn.id, input.columnId));
      bus.emitBoard(input.boardId, {
        scope: "column",
        ids: [input.columnId],
      });
    }),
});
