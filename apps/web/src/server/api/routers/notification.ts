import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  notification,
  project,
  task,
  user as userTable,
} from "@/server/db/schema";
import { subscribeUser } from "@/server/realtime/bus";

export const notificationRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(30) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 30;
      const userId = ctx.session.user.id;
      const rows = await ctx.db
        .select({
          id: notification.id,
          type: notification.type,
          data: notification.data,
          projectId: notification.projectId,
          boardId: notification.boardId,
          taskId: notification.taskId,
          readAt: notification.readAt,
          createdAt: notification.createdAt,
          actorId: notification.actorId,
          actorName: userTable.name,
          actorImage: userTable.image,
          taskTitle: task.title,
          projectSlug: project.slug,
          projectName: project.name,
        })
        .from(notification)
        .leftJoin(userTable, eq(userTable.id, notification.actorId))
        .leftJoin(task, eq(task.id, notification.taskId))
        .leftJoin(project, eq(project.id, notification.projectId))
        .where(eq(notification.userId, userId))
        .orderBy(desc(notification.createdAt))
        .limit(limit);
      return rows;
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [row] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
    return row?.count ?? 0;
  }),

  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await ctx.db
        .update(notification)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notification.userId, userId),
            sql`${notification.id} = ANY(${input.ids})`,
            isNull(notification.readAt),
          ),
        );
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await ctx.db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  }),

  onChange: protectedProcedure.subscription(async function* ({ ctx, signal }) {
    for await (const evt of subscribeUser(ctx.session.user.id, signal)) {
      yield evt;
    }
  }),
});
