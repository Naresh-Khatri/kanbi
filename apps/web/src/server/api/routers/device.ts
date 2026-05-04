import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { deviceToken } from "@/server/db/schema";
import { mintDeviceToken } from "@/server/device-tokens";

export const deviceRouter = createTRPCRouter({
  issue: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { plaintext, hash, prefix } = mintDeviceToken();
      const [row] = await ctx.db
        .insert(deviceToken)
        .values({
          userId: ctx.session.user.id,
          name: input.name?.length ? input.name : "Focus device",
          tokenHash: hash,
          tokenPrefix: prefix,
        })
        .returning({
          id: deviceToken.id,
          name: deviceToken.name,
          tokenPrefix: deviceToken.tokenPrefix,
          createdAt: deviceToken.createdAt,
        });

      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return { ...row, token: plaintext };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: deviceToken.id,
        name: deviceToken.name,
        tokenPrefix: deviceToken.tokenPrefix,
        lastSeenAt: deviceToken.lastSeenAt,
        createdAt: deviceToken.createdAt,
        revokedAt: deviceToken.revokedAt,
      })
      .from(deviceToken)
      .where(
        and(
          eq(deviceToken.userId, ctx.session.user.id),
          isNull(deviceToken.revokedAt),
        ),
      )
      .orderBy(desc(deviceToken.createdAt));
  }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(deviceToken)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(deviceToken.id, input.id),
            eq(deviceToken.userId, ctx.session.user.id),
          ),
        )
        .returning({ id: deviceToken.id });
      if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),

  rename: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(deviceToken)
        .set({ name: input.name })
        .where(
          and(
            eq(deviceToken.id, input.id),
            eq(deviceToken.userId, ctx.session.user.id),
          ),
        )
        .returning({ id: deviceToken.id });
      if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),
});
