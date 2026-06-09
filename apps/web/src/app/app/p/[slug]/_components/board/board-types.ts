import type { RouterOutputs } from "@/trpc/react";

export type BoardData = RouterOutputs["board"]["get"];
export type TaskRow = BoardData["tasks"][number];
export type ColumnRow = BoardData["columns"][number];

export type ActiveDrag =
  | { kind: "task"; task: TaskRow }
  | { kind: "column"; column: ColumnRow }
  | null;

export type DropTarget = {
  columnId: string;
  beforeTaskId: string | null;
} | null;

export type MemberInfo = { name: string; image: string | null };
