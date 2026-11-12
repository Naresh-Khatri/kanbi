import type { RouterOutputs } from "@/trpc/react";

export type PublicBoard = Extract<
  RouterOutputs["share"]["getPublic"],
  { status: "ok" }
>;
export type PublicTask = PublicBoard["tasks"][number];
export type PublicColumn = PublicBoard["columns"][number];
export type PublicLabel = PublicBoard["labels"][number];
export type PublicAssignee = PublicBoard["assignees"][number];
export type PublicChecklistItem = PublicBoard["checklist"][number];

export type TaskView = {
  task: PublicTask;
  key: string;
  column: PublicColumn;
  labels: PublicLabel[];
  assignee: PublicAssignee | null;
  checklist: PublicChecklistItem[];
  done: boolean;
  overdue: boolean;
};

export const DONE_CATEGORIES = new Set(["completed", "canceled"]);
