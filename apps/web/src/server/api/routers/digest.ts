import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import { digest } from "@/server/db/schema";
import { generateBoardDigest } from "@/server/digest/generate";

export const digestRouter = createTRPCRouter({
  /** Latest stored digest for the board, or null if none generated yet. */
  latest: boardProcedure.query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select()
      .from(digest)
      .where(eq(digest.boardId, input.boardId))
      .orderBy(desc(digest.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }),

  /** Mine the last 7 days of activity and write a fresh AI digest. */
  generate: boardProcedure.mutation(async ({ ctx, input }) => {
    assertCanWrite(ctx.access);
    const result = await generateBoardDigest(ctx.db, input.boardId);
    if (!result) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No activity in the last 7 days to summarize.",
      });
    }
    return result;
  }),
});
