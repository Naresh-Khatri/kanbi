import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  board,
  boardColumn,
  notification,
  oauthAccessToken,
  oauthConsent,
  oauthRefreshToken,
  project,
  task,
  user as userTable,
} from "@/server/db/schema";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        image: userTable.image,
      })
      .from(userTable)
      .where(eq(userTable.id, ctx.session.user.id))
      .limit(1);
    return row ?? null;
  }),

  // Cross-project personal home: everything on the caller's plate. Tasks
  // assigned to me (with column + project context so the client can bucket
  // overdue / due-soon) and recent @-mentions.
  myWork: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const assigned = await ctx.db
      .select({
        id: task.id,
        title: task.title,
        priority: task.priority,
        dueAt: task.dueAt,
        updatedAt: task.updatedAt,
        boardId: task.boardId,
        columnName: boardColumn.name,
        columnCategory: boardColumn.category,
        projectSlug: project.slug,
        projectName: project.name,
      })
      .from(task)
      .innerJoin(boardColumn, eq(boardColumn.id, task.columnId))
      .innerJoin(board, eq(board.id, task.boardId))
      .innerJoin(project, eq(project.id, board.projectId))
      .where(
        and(
          eq(task.assigneeId, userId),
          isNull(task.archivedAt),
          ne(project.status, "archived"),
        ),
      )
      .orderBy(asc(task.dueAt));

    const mentions = await ctx.db
      .select({
        id: notification.id,
        taskId: notification.taskId,
        taskTitle: task.title,
        projectSlug: project.slug,
        projectName: project.name,
        actorName: userTable.name,
        createdAt: notification.createdAt,
      })
      .from(notification)
      .leftJoin(task, eq(task.id, notification.taskId))
      .leftJoin(project, eq(project.id, notification.projectId))
      .leftJoin(userTable, eq(userTable.id, notification.actorId))
      .where(
        and(
          eq(notification.userId, userId),
          eq(notification.type, "task.mention"),
          ne(project.status, "archived"),
        ),
      )
      .orderBy(desc(notification.createdAt))
      .limit(10);

    return { assigned, mentions };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(60),
        image: z.string().url().max(500).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(userTable)
        .set({
          name: input.name,
          image: input.image,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, ctx.session.user.id));
      return { ok: true };
    }),

  revokeConnectedApp: protectedProcedure
    .input(z.object({ consentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      return ctx.db.transaction(async (tx) => {
        const [consent] = await tx
          .select({ clientId: oauthConsent.clientId })
          .from(oauthConsent)
          .where(
            and(
              eq(oauthConsent.id, input.consentId),
              eq(oauthConsent.userId, userId),
            ),
          )
          .limit(1);
        if (!consent) throw new TRPCError({ code: "NOT_FOUND" });

        const grant = and(
          eq(oauthAccessToken.clientId, consent.clientId),
          eq(oauthAccessToken.userId, userId),
        );
        await tx.delete(oauthAccessToken).where(grant);
        await tx
          .update(oauthRefreshToken)
          .set({ revoked: new Date() })
          .where(
            and(
              eq(oauthRefreshToken.clientId, consent.clientId),
              eq(oauthRefreshToken.userId, userId),
              isNull(oauthRefreshToken.revoked),
            ),
          );
        await tx
          .delete(oauthConsent)
          .where(
            and(
              eq(oauthConsent.clientId, consent.clientId),
              eq(oauthConsent.userId, userId),
            ),
          );

        return { ok: true };
      });
    }),
});
