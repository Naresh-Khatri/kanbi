import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  board,
  boardColumn,
  notification,
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
        projectSlug: project.slug,
        projectName: project.name,
      })
      .from(task)
      .innerJoin(boardColumn, eq(boardColumn.id, task.columnId))
      .innerJoin(board, eq(board.id, task.boardId))
      .innerJoin(project, eq(project.id, board.projectId))
      .where(and(eq(task.assigneeId, userId), isNull(task.archivedAt)))
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
});
