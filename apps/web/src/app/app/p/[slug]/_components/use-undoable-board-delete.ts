"use client";

import { toast } from "sonner";
import { api } from "@/trpc/react";

const UNDO_WINDOW_MS = 6000;

type DeleteTarget =
  | {
      kind: "column";
      id: string;
      name: string;
      moveTasksToColumnId?: string;
    }
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
          tasks: target.moveTasksToColumnId
            ? old.tasks.map((task) =>
                task.columnId === target.id
                  ? { ...task, columnId: target.moveTasksToColumnId! }
                  : task,
              )
            : old.tasks.filter((task) => task.columnId !== target.id),
        };
      }
      return { ...old, tasks: old.tasks.filter((t) => t.id !== target.id) };
    });
    onRemoved?.();

    let undone = false;
    const commit = setTimeout(() => {
      if (undone) return;
      if (target.kind === "column") {
        deleteColumn.mutate({
          boardId,
          columnId: target.id,
          moveTasksToColumnId: target.moveTasksToColumnId,
        });
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
            if (!snapshot) return;
            utils.board.get.setData({ boardId }, (current) => {
              if (!current) return snapshot;
              if (target.kind === "column") {
                const removedColumn = snapshot.columns.find(
                  (column) => column.id === target.id,
                );
                const removedTasks = snapshot.tasks.filter(
                  (task) => task.columnId === target.id,
                );
                return {
                  ...current,
                  columns:
                    removedColumn &&
                    !current.columns.some(
                      (column) => column.id === removedColumn.id,
                    )
                      ? [...current.columns, removedColumn]
                      : current.columns,
                  tasks: current.tasks
                    .filter(
                      (task) =>
                        !removedTasks.some(
                          (removedTask) => removedTask.id === task.id,
                        ),
                    )
                    .concat(removedTasks),
                };
              }
              const removedTask = snapshot.tasks.find(
                (task) => task.id === target.id,
              );
              return removedTask &&
                !current.tasks.some((task) => task.id === removedTask.id)
                ? { ...current, tasks: [...current.tasks, removedTask] }
                : current;
            });
          },
        },
      },
    );
  };
}
