"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ColumnSortDir, ColumnSortMode } from "@/lib/task-sort";
import { api } from "@/trpc/react";
import type { ColumnRow } from "./board-types";
import { useUndoableBoardDelete } from "../use-undoable-board-delete";

const SORT_LABELS: Record<Exclude<ColumnSortMode, "manual">, string> = {
  priority: "Priority",
  assignee: "Assignee",
  dueAt: "Due date",
  createdAt: "Added date",
};

const SORT_MODES = Object.keys(SORT_LABELS) as Array<
  Exclude<ColumnSortMode, "manual">
>;

export function ColumnHeader({
  boardId,
  column,
  canWrite,
  taskCount,
  dragHandleProps,
}: {
  boardId: string;
  column: ColumnRow;
  canWrite: boolean;
  taskCount: number;
  dragHandleProps: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const utils = api.useUtils();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);

  const rename = api.column.rename.useMutation({
    onSuccess: async () => {
      setRenaming(false);
      await utils.board.get.invalidate({ boardId });
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useUndoableBoardDelete(boardId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const setSort = api.column.setSort.useMutation({
    onMutate: async (vars) => {
      await utils.board.get.cancel({ boardId });
      const previous = utils.board.get.getData({ boardId });
      utils.board.get.setData({ boardId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          columns: old.columns.map((c) =>
            c.id === vars.columnId
              ? { ...c, sortMode: vars.sortMode, sortDir: vars.sortDir }
              : c,
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.board.get.setData({ boardId }, ctx.previous);
      toast.error("Couldn't update sort");
    },
    onSettled: () => utils.board.get.invalidate({ boardId }),
  });

  const sortMode = column.sortMode as ColumnSortMode;
  const sortDir = column.sortDir as ColumnSortDir;
  const sorted = sortMode !== "manual";

  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setMenuOpen(false), 150);
  };
  useEffect(() => () => cancelClose(), []);

  function applySort(mode: ColumnSortMode, dir: ColumnSortDir = sortDir) {
    setSort.mutate({
      boardId,
      columnId: column.id,
      sortMode: mode,
      sortDir: dir,
    });
  }

  return (
    <div className="flex items-center gap-1 px-1">
      {canWrite ? (
        <button
          aria-label="Drag column"
          className="cursor-grab p-2 text-white/40 hover:text-white/80 active:cursor-grabbing"
          type="button"
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </button>
      ) : null}
      {renaming ? (
        <form
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            rename.mutate({ boardId, columnId: column.id, name });
          }}
        >
          <Input
            autoFocus
            onBlur={() => setRenaming(false)}
            onChange={(e) => setName(e.target.value)}
            value={name}
          />
        </form>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            className="min-w-0 truncate text-left text-sm font-medium"
            disabled={!canWrite}
            onClick={() => setRenaming(true)}
            type="button"
          >
            {column.name}
            <span className="ml-2 text-xs text-white/40">{taskCount}</span>
          </button>
          {sorted ? (
            <button
              className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-sky-300/80 hover:text-sky-200"
              onClick={() => canWrite && applySort("manual")}
              title={
                canWrite
                  ? `Sorted by ${SORT_LABELS[sortMode as Exclude<ColumnSortMode, "manual">].toLowerCase()} — click to clear`
                  : `Sorted by ${SORT_LABELS[sortMode as Exclude<ColumnSortMode, "manual">].toLowerCase()}`
              }
              type="button"
            >
              {sortDir === "asc" ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              <span className="lowercase">
                {SORT_LABELS[sortMode as Exclude<ColumnSortMode, "manual">]}
              </span>
            </button>
          ) : null}
        </div>
      )}
      {canWrite ? (
        <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span>Sort by</span>
                <ChevronRight className="ml-2 h-3.5 w-3.5 opacity-60" />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                {SORT_MODES.map((m) => {
                  const isActive = sortMode === m;
                  return (
                    <DropdownMenuItem
                      className={
                        isActive
                          ? "bg-sky-400/15 text-sky-200 focus:bg-sky-400/25"
                          : undefined
                      }
                      key={m}
                      onSelect={(e) => {
                        e.preventDefault();
                        if (isActive) {
                          applySort(m, sortDir === "asc" ? "desc" : "asc");
                        } else {
                          applySort(m, "asc");
                        }
                      }}
                    >
                      <span className="flex-1">{SORT_LABELS[m]}</span>
                      {isActive ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : null}
                    </DropdownMenuItem>
                  );
                })}
                {sorted ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        applySort("manual");
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Clear sort</span>
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onSelect={() => {
                if (taskCount > 0) {
                  setConfirmDelete(true);
                } else {
                  void remove({
                    kind: "column",
                    id: column.id,
                    name: column.name,
                  });
                }
              }}
            >
              Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <Dialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{column.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This column has {taskCount} {taskCount === 1 ? "task" : "tasks"}.
              Deleting it removes {taskCount === 1 ? "it" : "them"} too. You can
              undo for a few seconds.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setConfirmDelete(false)} variant="ghost">
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmDelete(false);
                void remove({
                  kind: "column",
                  id: column.id,
                  name: column.name,
                });
              }}
              variant="destructive"
            >
              Delete column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
