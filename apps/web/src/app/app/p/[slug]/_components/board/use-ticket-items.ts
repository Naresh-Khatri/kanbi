import { useMemo } from "react";

import type { TicketMentionItem } from "@/components/rich-text/mention";
import type { RouterOutputs } from "@/trpc/react";
import type { MemberInfo } from "./board-types";

type BoardData = RouterOutputs["board"]["get"];

// current project only; status/priority/assignee feed the chip hover card
export function useTicketItems(
  tasks: BoardData["tasks"],
  columns: BoardData["columns"],
  projectKey: string,
  membersById: ReadonlyMap<string, MemberInfo>,
): TicketMentionItem[] {
  return useMemo(() => {
    const colName = new Map(columns.map((c) => [c.id, c.name]));
    return tasks.map((t) => ({
      id: t.id,
      label: `${projectKey}-${t.number}`,
      title: t.title,
      status: colName.get(t.columnId),
      priority: t.priority,
      assignee: t.assigneeId
        ? (membersById.get(t.assigneeId)?.name ?? null)
        : null,
    }));
  }, [tasks, projectKey, columns, membersById]);
}
