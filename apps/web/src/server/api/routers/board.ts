import { and, asc, eq, gt, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

import { discloseActivity } from "@/server/activity/disclosure";
import { summarizeUpdates } from "@/server/activity/updates";
import { boardProcedure, createTRPCRouter } from "@/server/api/trpc";
import {
  activity,
  boardColumn,
  boardSeen,
  boardViewPreference,
  label,
  milestone,
  task,
  taskLabel,
  taskSeen,
} from "@/server/db/schema";
import { taskReadColumns } from "@/server/tasks/columns";

const columnSortSchema = z.object({
  mode: z.enum(["manual", "priority", "assignee", "dueAt", "createdAt"]),
  dir: z.enum(["asc", "desc"]),
});

const viewPreferencesSchema = z.object({
  sorts: z.record(columnSortSchema),
  hiddenColumnIds: z.array(z.string()),
  collapsedColumnIds: z.array(z.string()),
  defaultColumnId: z.string().nullable(),
  milestoneFilter: z.string().nullable().default(null),
});

const UPDATES_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const UPDATES_ROW_LIMIT = 2_000;

const DEFAULT_VIEW_PREFERENCES: z.infer<typeof viewPreferencesSchema> = {
  sorts: {},
  hiddenColumnIds: [],
  collapsedColumnIds: [],
  defaultColumnId: null,
  milestoneFilter: null,
};

export const boardRouter = createTRPCRouter({
  get: boardProcedure.query(async ({ ctx, input }) => {
    const [columns, tasks, labels, taskLabels, viewPreferences, milestones] =
      await Promise.all([
        ctx.db
          .select()
          .from(boardColumn)
          .where(eq(boardColumn.boardId, input.boardId))
          .orderBy(asc(boardColumn.position)),
        ctx.db
          .select(taskReadColumns)
          .from(task)
          .where(eq(task.boardId, input.boardId))
          .orderBy(asc(task.position)),
        ctx.db.select().from(label).where(eq(label.boardId, input.boardId)),
        ctx.db
          .select({ taskId: taskLabel.taskId, labelId: taskLabel.labelId })
          .from(taskLabel)
          .innerJoin(task, eq(task.id, taskLabel.taskId))
          .where(eq(task.boardId, input.boardId)),
        ctx.db
          .select({
            sorts: boardViewPreference.sorts,
            hiddenColumnIds: boardViewPreference.hiddenColumnIds,
            collapsedColumnIds: boardViewPreference.collapsedColumnIds,
            defaultColumnId: boardViewPreference.defaultColumnId,
            milestoneFilter: boardViewPreference.milestoneFilter,
          })
          .from(boardViewPreference)
          .where(
            and(
              eq(boardViewPreference.boardId, input.boardId),
              eq(boardViewPreference.userId, ctx.session.user.id),
            ),
          )
          .limit(1),
        ctx.db
          .select()
          .from(milestone)
          .where(eq(milestone.boardId, input.boardId))
          .orderBy(asc(milestone.position)),
      ]);

    return {
      columns,
      tasks,
      labels,
      taskLabels,
      milestones,
      viewPreferences: viewPreferences[0] ?? DEFAULT_VIEW_PREFERENCES,
      access: ctx.access,
    };
  }),

  setViewPreferences: boardProcedure
    .input(viewPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      const values = {
        sorts: input.sorts,
        hiddenColumnIds: [...new Set(input.hiddenColumnIds)],
        collapsedColumnIds: [...new Set(input.collapsedColumnIds)],
        defaultColumnId: input.defaultColumnId,
        milestoneFilter: input.milestoneFilter,
      };
      await ctx.db
        .insert(boardViewPreference)
        .values({
          boardId: input.boardId,
          userId: ctx.session.user.id,
          ...values,
        })
        .onConflictDoUpdate({
          target: [boardViewPreference.boardId, boardViewPreference.userId],
          set: { ...values, updatedAt: new Date() },
        });
      return values;
    }),

  /** Tasks changed by someone else (or the user's agents) since the user last looked. */
  updates: boardProcedure.query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    // first visit: start the clock now instead of flagging the whole history
    await ctx.db
      .insert(boardSeen)
      .values({ userId, boardId: input.boardId, seenAt: new Date() })
      .onConflictDoNothing();
    const [seen] = await ctx.db
      .select({ seenAt: boardSeen.seenAt })
      .from(boardSeen)
      .where(
        and(eq(boardSeen.userId, userId), eq(boardSeen.boardId, input.boardId)),
      )
      .limit(1);
    const floor = new Date(
      Math.max(
        seen?.seenAt.getTime() ?? Date.now(),
        Date.now() - UPDATES_WINDOW_MS,
      ),
    );

    const rows = await ctx.db
      .select({
        taskId: sql<string>`${activity.taskId}`,
        verb: activity.verb,
        payload: activity.payload,
        actorId: activity.actorId,
        createdAt: activity.createdAt,
      })
      .from(activity)
      .innerJoin(task, eq(task.id, activity.taskId))
      .leftJoin(
        taskSeen,
        and(eq(taskSeen.taskId, activity.taskId), eq(taskSeen.userId, userId)),
      )
      .where(
        and(
          eq(activity.boardId, input.boardId),
          isNotNull(activity.taskId),
          isNull(task.archivedAt),
          gt(activity.createdAt, floor),
          or(isNull(taskSeen.seenAt), gt(activity.createdAt, taskSeen.seenAt)),
          // own work isn't news, unless an agent did it for the user
          or(
            ne(activity.actorId, userId),
            sql`${activity.payload}->>'agent' is not null`,
          ),
        ),
      )
      .orderBy(sql`${activity.createdAt} desc`)
      .limit(UPDATES_ROW_LIMIT);

    return summarizeUpdates(rows.map((r) => discloseActivity(ctx.access, r)));
  }),

  markSeen: boardProcedure
    .input(z.object({ taskId: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const seenAt = new Date();
      if (input.taskId) {
        const [t] = await ctx.db
          .select({ id: task.id })
          .from(task)
          .where(
            and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)),
          )
          .limit(1);
        if (!t) return;
        await ctx.db
          .insert(taskSeen)
          .values({ userId, taskId: t.id, seenAt })
          .onConflictDoUpdate({
            target: [taskSeen.userId, taskSeen.taskId],
            set: { seenAt },
          });
        return;
      }
      await ctx.db
        .insert(boardSeen)
        .values({ userId, boardId: input.boardId, seenAt })
        .onConflictDoUpdate({
          target: [boardSeen.userId, boardSeen.boardId],
          set: { seenAt },
        });
    }),
});
