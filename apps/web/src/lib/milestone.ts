export type MilestoneStatus = "upcoming" | "active" | "closed";

/** Board filter value: null = all tasks, "none" = no milestone, else an id. */
export type MilestoneFilter = string | null;
export const NO_MILESTONE = "none";

type ColumnCategory =
  | "backlog"
  | "unstarted"
  | "started"
  | "review"
  | "completed"
  | "canceled";

export type MilestoneProgress = { done: number; total: number };

/** canceled tasks don't count toward either side; archived ones only when `withArchived` */
export function milestoneProgress(
  tasks: readonly {
    milestoneId: string | null;
    columnId: string;
    archivedAt: Date | string | null;
  }[],
  categoryByColumn: ReadonlyMap<string, ColumnCategory>,
  milestoneId: string,
  // closed milestone: close archives its finished tasks, they're what shipped
  withArchived = false,
): MilestoneProgress {
  let done = 0;
  let total = 0;
  for (const t of tasks) {
    if (t.milestoneId !== milestoneId || (t.archivedAt && !withArchived))
      continue;
    const category = categoryByColumn.get(t.columnId);
    if (category === "canceled") continue;
    total += 1;
    if (category === "completed") done += 1;
  }
  return { done, total };
}

export function isResolvedCategory(category: ColumnCategory | undefined) {
  return category === "completed" || category === "canceled";
}

export function taskMatchesMilestone(
  task: { milestoneId: string | null },
  filter: MilestoneFilter,
) {
  if (filter === null) return true;
  if (filter === NO_MILESTONE) return task.milestoneId === null;
  return task.milestoneId === filter;
}

export type TargetTone = "overdue" | "soon" | "normal";

/** same buckets as due dates: past = overdue, next 3 days = soon */
export function targetTone(
  targetAt: Date | string | null,
  now: Date = new Date(),
): TargetTone | null {
  if (!targetAt) return null;
  const t = new Date(targetAt).getTime();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (t < startOfToday.getTime()) return "overdue";
  if (t < startOfToday.getTime() + 4 * 86_400_000) return "soon";
  return "normal";
}
