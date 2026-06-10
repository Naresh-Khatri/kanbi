"use client";

import { ArchiveRestore, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/trpc/react";
import { type Priority, PriorityIcon } from "../priority";
import { useUndoableBoardDelete } from "../use-undoable-board-delete";
import type { TaskRow } from "./board-types";

export function ArchivePanel({
  boardId,
  open,
  onOpenChange,
  tasks,
  columnNameById,
  canWrite,
}: {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: TaskRow[];
  columnNameById: Map<string, string>;
  canWrite: boolean;
}) {
  const utils = api.useUtils();
  const removeTask = useUndoableBoardDelete(boardId);
  const restore = api.task.archive.useMutation({
    onMutate: async (vars) => {
      await utils.board.get.cancel({ boardId });
      const previous = utils.board.get.getData({ boardId });
      utils.board.get.setData({ boardId }, (old) =>
        old
          ? {
              ...old,
              tasks: old.tasks.map((t) =>
                t.id === vars.taskId ? { ...t, archivedAt: null } : t,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) utils.board.get.setData({ boardId }, ctx.previous);
    },
    onSettled: () => utils.board.get.invalidate({ boardId }),
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Archived tasks</DialogTitle>
          <DialogDescription>
            {tasks.length === 0
              ? "Nothing archived."
              : `${tasks.length} archived ${
                  tasks.length === 1 ? "task" : "tasks"
                }. Restore puts a task back in its column.`}
          </DialogDescription>
        </DialogHeader>
        {tasks.length > 0 ? (
          <ul className="-mr-2 flex max-h-[60vh] flex-col gap-1 overflow-y-auto pr-2">
            {tasks.map((t) => (
              <li
                className="flex items-center gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
                key={t.id}
              >
                <PriorityIcon
                  className="h-3.5 w-3.5 shrink-0"
                  priority={t.priority as Priority}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-white/90">
                    {t.title}
                  </span>
                  <span className="truncate text-xs text-white/40">
                    {columnNameById.get(t.columnId) ?? "—"}
                    {t.archivedAt
                      ? ` · archived ${new Date(
                          t.archivedAt,
                        ).toLocaleDateString()}`
                      : ""}
                  </span>
                </div>
                {canWrite ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      onClick={() =>
                        restore.mutate({
                          boardId,
                          taskId: t.id,
                          archived: false,
                        })
                      }
                      size="sm"
                      variant="outline"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                    </Button>
                    <button
                      aria-label="Delete permanently"
                      className="rounded p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white"
                      onClick={() =>
                        void removeTask({
                          kind: "task",
                          id: t.id,
                          name: t.title,
                        })
                      }
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
