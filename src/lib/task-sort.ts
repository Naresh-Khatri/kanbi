export type ColumnSortMode =
  | "manual"
  | "priority"
  | "assignee"
  | "dueAt"
  | "createdAt";

export type ColumnSortDir = "asc" | "desc";

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

type SortableTask = {
  id: string;
  position: number;
  priority: string;
  assigneeId: string | null;
  dueAt: Date | null;
  createdAt: Date;
};

type AssigneeNameLookup = (id: string) => string | undefined;

export function compareTasks(
  mode: ColumnSortMode,
  dir: ColumnSortDir,
  assigneeName: AssigneeNameLookup,
): (a: SortableTask, b: SortableTask) => number {
  if (mode === "manual") {
    return (a, b) => a.position - b.position;
  }
  const sign = dir === "desc" ? -1 : 1;
  const tiebreak = (a: SortableTask, b: SortableTask) =>
    a.position - b.position || (a.id < b.id ? -1 : 1);

  switch (mode) {
    case "priority":
      return (a, b) => {
        const diff =
          (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
        return diff !== 0 ? diff * sign : tiebreak(a, b);
      };
    case "assignee":
      return (a, b) => {
        const aMissing = !a.assigneeId;
        const bMissing = !b.assigneeId;
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
        if (!aMissing && !bMissing) {
          const an = (assigneeName(a.assigneeId!) ?? "").toLowerCase();
          const bn = (assigneeName(b.assigneeId!) ?? "").toLowerCase();
          if (an !== bn) return an < bn ? -1 * sign : 1 * sign;
        }
        return tiebreak(a, b);
      };
    case "dueAt":
      return (a, b) => {
        const aMissing = !a.dueAt;
        const bMissing = !b.dueAt;
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
        if (!aMissing && !bMissing) {
          const diff = a.dueAt!.getTime() - b.dueAt!.getTime();
          if (diff !== 0) return diff * sign;
        }
        return tiebreak(a, b);
      };
    case "createdAt":
      return (a, b) => {
        const diff = a.createdAt.getTime() - b.createdAt.getTime();
        return diff !== 0 ? diff * sign : tiebreak(a, b);
      };
    default:
      return tiebreak;
  }
}
