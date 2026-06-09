"use client";

import { toast } from "sonner";
import { api } from "@/trpc/react";

const UNDO_WINDOW_MS = 6000;

type DeleteTarget =
  | { kind: "column"; id: string; name: string }
  | { kind: "task"; id: string; name: string };

/**
 * Deletes a column or task with an undo grace period. The row is pulled from
 * the board cache immediately, but the actual (cascading, irreversible) server
 * delete is held back until the undo window closes — so Undo just restores the
 * snapshot without having to re-create anything.
 */
export function useUndoableBoardDelete(boardId: string) {
  const utils = api.useUtils();
  const deleteColumn = api.column.delete.useMutation({
    onError: (e) => {
      toast.error(e.message);
      void utils.board.get.invalidate({ boardId });
    },
    onSettled: () => utils.board.get.invalidate({ boardId }),
  });
  const deleteTask = api.task.delete.useMutation({
    onError: (e) => {
      toast.error(e.message);
      void utils.board.get.invalidate({ boardId });
    },
    onSettled: () => utils.board.get.invalidate({ boardId }),
  });

  return async function remove(target: DeleteTarget, onRemoved?: () => void) {
    await utils.board.get.cancel({ boardId });
    const snapshot = utils.board.get.getData({ boardId });
    utils.board.get.setData({ boardId }, (old) => {
      if (!old) return old;
      if (target.kind === "column") {
        return {
          ...old,
          columns: old.columns.filter((c) => c.id !== target.id),
          tasks: old.tasks.filter((t) => t.columnId !== target.id),
        };
      }
      return { ...old, tasks: old.tasks.filter((t) => t.id !== target.id) };
    });
    onRemoved?.();

    let undone = false;
    const commit = setTimeout(() => {
      if (undone) return;
      if (target.kind === "column") {
        deleteColumn.mutate({ boardId, columnId: target.id });
      } else {
        deleteTask.mutate({ boardId, taskId: target.id });
      }
    }, UNDO_WINDOW_MS);

    toast(
      target.kind === "column"
        ? `Deleted column "${target.name}"`
        : `Deleted "${target.name}"`,
      {
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Undo",
          onClick: () => {
            undone = true;
            clearTimeout(commit);
            if (snapshot) utils.board.get.setData({ boardId }, snapshot);
          },
        },
      },
    );
  };
}
