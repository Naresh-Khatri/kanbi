"use client";

import { formatRelative } from "@kanbi/shared";
import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
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
    <Drawer onOpenChange={onOpenChange} open={open} position="right">
      <DrawerPopup showCloseButton variant="inset">
        <DrawerHeader>
          <DrawerTitle>Archived tasks</DrawerTitle>
          <DrawerDescription>
            {tasks.length === 0
              ? "Nothing archived."
              : `${tasks.length} archived ${
                  tasks.length === 1 ? "task" : "tasks"
                }. Restore puts a task back in its column.`}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel>
          {tasks.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ArchiveIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No archived tasks</EmptyTitle>
                <EmptyDescription>
                  Archived tasks land here instead of being deleted.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="bg-card flex flex-col divide-y rounded-xl border">
              {tasks.map((t) => (
                <li className="flex items-center gap-3 px-3 py-2" key={t.id}>
                  <PriorityIcon
                    className="size-3.5 shrink-0"
                    priority={t.priority as Priority}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm">{t.title}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {columnNameById.get(t.columnId) ?? "—"}
                      {t.archivedAt
                        ? ` · archived ${formatRelative(t.archivedAt)}`
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
                        size="xs"
                        variant="outline"
                      >
                        <ArchiveRestoreIcon aria-hidden="true" /> Restore
                      </Button>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              aria-label="Delete permanently"
                              className="text-muted-foreground hover:text-destructive-foreground"
                              onClick={() =>
                                void removeTask({
                                  kind: "task",
                                  id: t.id,
                                  name: t.title,
                                })
                              }
                              size="icon-xs"
                              type="button"
                              variant="ghost"
                            />
                          }
                        >
                          <Trash2Icon aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipPopup>Delete permanently</TooltipPopup>
                      </Tooltip>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  );
}
