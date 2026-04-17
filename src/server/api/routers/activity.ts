import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { boardProcedure, createTRPCRouter } from "@/server/api/trpc";
import { activity, user as userTable } from "@/server/db/schema";

export const activityRouter = createTRPCRouter({
  list: boardProcedure
    .input(
      z.object({
        taskId: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(200).default(100),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db
        .select({
          id: activity.id,
          boardId: activity.boardId,
          taskId: activity.taskId,
          verb: activity.verb,
          payload: activity.payload,
          createdAt: activity.createdAt,
          actorName: userTable.name,
          actorImage: userTable.image,
        })
        .from(activity)
        .innerJoin(userTable, eq(userTable.id, activity.actorId))
        .where(
          input.taskId
            ? and(
                eq(activity.boardId, input.boardId),
                eq(activity.taskId, input.taskId),
              )
            : eq(activity.boardId, input.boardId),
        )
        .orderBy(desc(activity.createdAt))
        .limit(input.limit),
    ),
});
