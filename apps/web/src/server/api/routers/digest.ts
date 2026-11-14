import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import { digest } from "@/server/db/schema";
import { AiNotConfiguredError } from "@/server/ai/model";
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
    let result;
    try {
      result = await generateBoardDigest(ctx.db, input.boardId);
    } catch (error) {
      console.error("[digest] generate failed", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof AiNotConfiguredError
            ? "AI digests aren't configured on this server."
            : "Couldn't write the digest right now. Try again in a moment.",
      });
    }
    if (!result) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No activity in the last 7 days to summarize.",
      });
    }
    return result;
  }),
});
