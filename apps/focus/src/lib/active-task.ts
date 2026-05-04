import type { FocusColumn, FocusBoardSnapshot, FocusTask } from "./trpc";

const DOING_HINTS = [
  "in progress",
  "in-progress",
  "doing",
  "wip",
  "active",
  "working",
];
const TODO_HINTS = ["todo", "to do", "to-do", "backlog", "next", "ready"];

function findColumn(columns: FocusColumn[], hints: string[]) {
  return (
    columns.find((c) => {
      const name = c.name.toLowerCase();
      return hints.some((h) => name.includes(h));
    }) ?? null
  );
}

/**
 * Pick the task to spotlight: top of an "in progress"-like column, falling back
 * to the top of a "todo"-like column, falling back to the first task overall.
 */
export function pickActiveTask(
  data: FocusBoardSnapshot,
  preferredColumnId: string | null,
): { task: FocusTask | null; column: FocusColumn | null } {
  if (data.tasks.length === 0) return { task: null, column: null };

  const columnsById = new Map(data.columns.map((c) => [c.id, c]));

  const tryColumn = (col: FocusColumn | null) => {
    if (!col) return null;
    const top = data.tasks
      .filter((t) => t.columnId === col.id)
      .sort((a, b) => a.position - b.position)[0];
    return top ? { task: top, column: col } : null;
  };

  if (preferredColumnId) {
    const hit = tryColumn(columnsById.get(preferredColumnId) ?? null);
    if (hit) return hit;
  }

  const doing = findColumn(data.columns, DOING_HINTS);
  const fromDoing = tryColumn(doing);
  if (fromDoing) return fromDoing;

  const todo = findColumn(data.columns, TODO_HINTS);
  const fromTodo = tryColumn(todo);
  if (fromTodo) return fromTodo;

  const fallback = [...data.tasks].sort((a, b) => a.position - b.position)[0];
  return {
    task: fallback ?? null,
    column: fallback ? (columnsById.get(fallback.columnId) ?? null) : null,
  };
}

export function priorityColor(priority: FocusTask["priority"]) {
  switch (priority) {
    case "urgent":
      return "#ef4444";
    case "high":
      return "#f97316";
    case "medium":
      return "#eab308";
    case "low":
      return "#3b82f6";
    default:
      return "#6b7280";
  }
}
