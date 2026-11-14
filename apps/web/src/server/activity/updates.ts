export type UpdateReason = "blocked" | "done" | "comment" | "updated";

export type TaskUpdate = {
  taskId: string;
  reason: UpdateReason;
  count: number;
  /** agent name when an agent made the latest change */
  agent: string | null;
  at: Date;
};

type ActivityRow = {
  taskId: string;
  verb: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
};

/**
 * Collapse unseen activity into one badge per task. The latest state change
 * wins (blocked / moved to done); otherwise a comment beats a plain edit.
 */
export function summarizeUpdates(rows: readonly ActivityRow[]): TaskUpdate[] {
  const byTask = new Map<string, ActivityRow[]>();
  for (const row of rows) {
    const list = byTask.get(row.taskId);
    if (list) list.push(row);
    else byTask.set(row.taskId, [row]);
  }

  const out: TaskUpdate[] = [];
  for (const [taskId, list] of byTask) {
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const latest = list[0]!;
    const state = list.find(
      (r) => r.verb === "task.blocked" || r.verb === "task.moved",
    );
    const reason: UpdateReason =
      state?.verb === "task.blocked"
        ? "blocked"
        : state?.payload?.toColumnCategory === "completed"
          ? "done"
          : list.some((r) => r.verb === "comment.created")
            ? "comment"
            : "updated";
    const agent = latest.payload?.agent;
    out.push({
      taskId,
      reason,
      count: list.length,
      agent: typeof agent === "string" ? agent : null,
      at: latest.createdAt,
    });
  }
  return out;
}
