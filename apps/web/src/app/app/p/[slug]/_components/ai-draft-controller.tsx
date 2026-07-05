"use client";

import { useHotkeys } from "react-hotkeys-hook";

import { useAppShell } from "@/components/keybinds/shell-store";
import { api } from "@/trpc/react";
import { AiDraftDialog } from "./ai-draft-dialog";

// owns the AI draft dialog outside the board tree. open state lives in the
// shell store, so triggering it re-renders only this tiny component (not the
// board) -> dialog opens instantly. board data = same cached board.get query.
export function AiDraftController({
  boardId,
  projectId,
}: {
  boardId: string;
  projectId: string;
}) {
  const open = useAppShell((s) => s.aiDraftOpen);
  const setOpen = useAppShell((s) => s.setAiDraftOpen);
  const board = api.board.get.useQuery({ boardId }).data;

  const canWrite = board?.access.canWrite ?? false;
  const hasColumns = (board?.columns.length ?? 0) > 0;

  useHotkeys(
    "shift+v",
    (e) => {
      if (!canWrite || !hasColumns) return;
      e.preventDefault();
      setOpen(true);
    },
    { enableOnFormTags: false },
    [canWrite, hasColumns, setOpen],
  );

  if (!board || !canWrite || !hasColumns) return null;

  return (
    <AiDraftDialog
      boardId={boardId}
      columns={board.columns}
      labels={board.labels}
      onOpenChange={setOpen}
      open={open}
      projectId={projectId}
    />
  );
}
