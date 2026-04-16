import { asc, eq } from "drizzle-orm";

import { boardProcedure, createTRPCRouter } from "@/server/api/trpc";
import { boardColumn, label, task, taskLabel } from "@/server/db/schema";

export const boardRouter = createTRPCRouter({
  get: boardProcedure.query(async ({ ctx, input }) => {
    const [columns, tasks, labels, taskLabels] = await Promise.all([
      ctx.db
        .select()
        .from(boardColumn)
        .where(eq(boardColumn.boardId, input.boardId))
        .orderBy(asc(boardColumn.position)),
      ctx.db
        .select()
        .from(task)
        .where(eq(task.boardId, input.boardId))
        .orderBy(asc(task.position)),
      ctx.db.select().from(label).where(eq(label.boardId, input.boardId)),
      ctx.db
        .select({ taskId: taskLabel.taskId, labelId: taskLabel.labelId })
        .from(taskLabel)
        .innerJoin(task, eq(task.id, taskLabel.taskId))
        .where(eq(task.boardId, input.boardId)),
    ]);

    return {
      columns,
      tasks,
      labels,
      taskLabels,
      access: ctx.access,
    };
  }),
});
