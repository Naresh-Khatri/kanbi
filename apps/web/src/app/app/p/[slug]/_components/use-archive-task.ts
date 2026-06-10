"use client";

import { toast } from "sonner";
import { api } from "@/trpc/react";

/**
 * Archive a task optimistically (it drops off the board immediately) with an
 * Undo toast. Shared by the card menu and the keyboard `x` shortcut.
 */
export function useArchiveTask(boardId: string) {
  const utils = api.useUtils();
  const setArchived = api.task.archive.useMutation({
    onMutate: async (vars) => {
      await utils.board.get.cancel({ boardId });
      const previous = utils.board.get.getData({ boardId });
      utils.board.get.setData({ boardId }, (old) =>
        old
          ? {
              ...old,
              tasks: old.tasks.map((t) =>
                t.id === vars.taskId
                  ? { ...t, archivedAt: vars.archived ? new Date() : null }
                  : t,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) utils.board.get.setData({ boardId }, ctx.previous);
      toast.error(e.message);
    },
    onSettled: () => utils.board.get.invalidate({ boardId }),
  });

  return function archiveTask(task: { id: string; title: string }) {
    setArchived.mutate({ boardId, taskId: task.id, archived: true });
    toast(`Archived "${task.title}"`, {
      action: {
        label: "Undo",
        onClick: () =>
          setArchived.mutate({ boardId, taskId: task.id, archived: false }),
      },
    });
  };
}
