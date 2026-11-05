import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { boardProcedure, createTRPCRouter } from "@/server/api/trpc";
import {
  boardColumn,
  boardViewPreference,
  label,
  task,
  taskLabel,
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
});

const DEFAULT_VIEW_PREFERENCES: z.infer<typeof viewPreferencesSchema> = {
  sorts: {},
  hiddenColumnIds: [],
  collapsedColumnIds: [],
  defaultColumnId: null,
};

export const boardRouter = createTRPCRouter({
  get: boardProcedure.query(async ({ ctx, input }) => {
    const [columns, tasks, labels, taskLabels, viewPreferences] =
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
          })
          .from(boardViewPreference)
          .where(
            and(
              eq(boardViewPreference.boardId, input.boardId),
              eq(boardViewPreference.userId, ctx.session.user.id),
            ),
          )
          .limit(1),
      ]);

    return {
      columns,
      tasks,
      labels,
      taskLabels,
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
});
