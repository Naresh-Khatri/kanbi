import type { boardColumn } from "@/server/db/schema";

type ColumnCategory = typeof boardColumn.$inferSelect.category;

export const DEFAULT_COLUMNS = [
  { name: "Backlog", category: "backlog", position: 1 },
  { name: "Todo", category: "unstarted", position: 2 },
  { name: "In Progress", category: "started", position: 3 },
  { name: "In Review", category: "review", position: 4 },
  { name: "Done", category: "completed", position: 5 },
] as const satisfies readonly {
  name: string;
  category: ColumnCategory;
  position: number;
}[];
