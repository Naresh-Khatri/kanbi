import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  board,
  boardColumn,
  boardShare,
  project,
  task,
} from "@/server/db/schema";

/**
 * Public, polling-friendly read for the Expo focus companion app.
 * Uses an existing share token but does not increment usesCount,
 * so a steady poll won't exhaust a `maxUses` cap.
 */
export const focusRouter = createTRPCRouter({
  peek: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const [share] = await ctx.db
        .select({
          id: boardShare.id,
          boardId: boardShare.boardId,
          maxUses: boardShare.maxUses,
          usesCount: boardShare.usesCount,
        })
        .from(boardShare)
        .where(
          and(
            eq(boardShare.token, input.token),
            isNull(boardShare.revokedAt),
            or(isNull(boardShare.expiresAt), gt(boardShare.expiresAt, now)),
          ),
        )
        .limit(1);

      if (!share) throw new TRPCError({ code: "NOT_FOUND" });
      if (share.maxUses != null && share.usesCount >= share.maxUses) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Share link exhausted",
        });
      }

      const [boardRow] = await ctx.db
        .select({
          id: board.id,
          projectName: project.name,
        })
        .from(board)
        .innerJoin(project, eq(project.id, board.projectId))
        .where(eq(board.id, share.boardId))
        .limit(1);
      if (!boardRow) throw new TRPCError({ code: "NOT_FOUND" });

      const [columns, tasks] = await Promise.all([
        ctx.db
          .select({
            id: boardColumn.id,
            name: boardColumn.name,
            position: boardColumn.position,
          })
          .from(boardColumn)
          .where(eq(boardColumn.boardId, share.boardId))
          .orderBy(asc(boardColumn.position)),
        ctx.db
          .select({
            id: task.id,
            title: task.title,
            columnId: task.columnId,
            priority: task.priority,
            position: task.position,
            dueAt: task.dueAt,
          })
          .from(task)
          .where(
            and(eq(task.boardId, share.boardId), isNull(task.archivedAt)),
          )
          .orderBy(asc(task.position)),
      ]);

      return { board: boardRow, columns, tasks, fetchedAt: now };
    }),
});
