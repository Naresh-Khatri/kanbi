"use client";

import { useEffect, useRef } from "react";

import type { TicketMentionItem } from "@/components/rich-text/mention";
import type { RouterOutputs } from "@/trpc/react";
import { TaskDetailSheet } from "../task-detail-sheet";
import { closeTaskSheet, useTaskSheet } from "./task-sheet-store";
import { useBoardUpdates, useMarkSeen } from "./use-board-updates";

type BoardData = RouterOutputs["board"]["get"];

export function TaskSheetHost({
  boardId,
  projectId,
  projectKey,
  projectSlug,
  canWrite,
  columns,
  tasks,
  labels,
  taskLabels,
  tickets,
  onExpand,
  onSeen,
}: {
  boardId: string;
  projectId: string;
  projectKey: string;
  projectSlug: string;
  canWrite: boolean;
  columns: BoardData["columns"];
  tasks: BoardData["tasks"];
  labels: BoardData["labels"];
  taskLabels: BoardData["taskLabels"];
  tickets: TicketMentionItem[];
  onExpand: (number: number) => void;
  onSeen: (taskId: string) => void;
}) {
  const openId = useTaskSheet((s) => s.openId);
  const openTask = openId ? (tasks.find((t) => t.id === openId) ?? null) : null;

  const openNumber = openTask?.number ?? null;
  const syncedNumber = useRef<number | null>(null);
  useEffect(() => {
    if (syncedNumber.current === openNumber) return;
    syncedNumber.current = openNumber;
    const url = new URL(window.location.href);
    if (openNumber == null) url.searchParams.delete("task");
    else url.searchParams.set("task", String(openNumber));
    window.history.replaceState(null, "", url);
  }, [openNumber]);

  const updates = useBoardUpdates(boardId);
  const markSeen = useMarkSeen(boardId);
  const hasUpdate = !!openId && updates.has(openId);
  useEffect(() => {
    if (!openId || !hasUpdate) return;
    onSeen(openId);
    markSeen(openId);
  }, [openId, hasUpdate, onSeen, markSeen]);

  useEffect(() => () => closeTaskSheet(), []);

  return (
    <TaskDetailSheet
      boardId={boardId}
      canWrite={canWrite}
      columns={columns}
      labels={labels}
      onExpand={onExpand}
      onOpenChange={(o) => {
        if (!o) closeTaskSheet();
      }}
      open={!!openTask}
      projectId={projectId}
      projectKey={projectKey}
      projectSlug={projectSlug}
      task={openTask}
      taskLabels={taskLabels}
      tasks={tasks}
      tickets={tickets}
    />
  );
}
