"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  GripVertical,
  EyeOff,
  PanelLeftClose,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import { useState } from "react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ColumnSortDir, ColumnSortMode } from "@/lib/task-sort";
import { cn } from "@/lib/utils";
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
  onAddTask,
  sortBlocked,
  columns,
  deletionTaskCount,
  totalTaskCount,
  sortMode,
  sortDir,
  onSortChange,
  onHide,
  onCollapse,
}: {
  boardId: string;
  column: ColumnRow;
  canWrite: boolean;
  taskCount: number;
  dragHandleProps: React.HTMLAttributes<HTMLButtonElement>;
  onAddTask: (columnId: string) => void;
  sortBlocked: boolean;
  columns: ColumnRow[];
  deletionTaskCount: number;
  totalTaskCount: number;
  sortMode: ColumnSortMode;
  sortDir: ColumnSortDir;
  onSortChange: (mode: ColumnSortMode, dir: ColumnSortDir) => void;
  onHide: () => void;
  onCollapse: () => void;
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
  const otherColumns = columns.filter(
    (candidate) => candidate.id !== column.id,
  );
  const [destinationColumnId, setDestinationColumnId] = useState(
    otherColumns[0]?.id ?? "",
  );
  const setWipLimit = api.column.setWipLimit.useMutation({
    onMutate: async (vars) => {
      await utils.board.get.cancel({ boardId });
      const previous = utils.board.get.getData({ boardId });
      utils.board.get.setData({ boardId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          columns: old.columns.map((c) =>
            c.id === vars.columnId ? { ...c, wipLimit: vars.wipLimit } : c,
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.board.get.setData({ boardId }, ctx.previous);
      toast.error("Couldn't update the WIP limit");
    },
    onSettled: () => utils.board.get.invalidate({ boardId }),
  });
  const sorted = sortMode !== "manual";
  const [wipDialogOpen, setWipDialogOpen] = useState(false);
  const [wipLimit, setWipLimitValue] = useState(
    column.wipLimit?.toString() ?? "",
  );

  function applySort(mode: ColumnSortMode, dir: ColumnSortDir = sortDir) {
    onSortChange(mode, dir);
  }

  const countLabel =
    taskCount < totalTaskCount
      ? `${taskCount} of ${totalTaskCount}${column.wipLimit != null ? ` · ${column.wipLimit} max` : ""}`
      : column.wipLimit != null
        ? `${totalTaskCount}/${column.wipLimit}`
        : String(totalTaskCount);
  const overWipLimit =
    column.wipLimit != null && totalTaskCount > column.wipLimit;

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
            <span
              className={cn(
                "ml-2 text-xs text-white/40",
                overWipLimit && "text-amber-300",
              )}
              title={
                overWipLimit
                  ? `${totalTaskCount - column.wipLimit!} over the WIP limit`
                  : taskCount < totalTaskCount
                    ? `${taskCount} visible out of ${totalTaskCount}`
                    : undefined
              }
            >
              {countLabel}
            </span>
          </button>
        </div>
      )}
      {canWrite ? (
        <Button
          aria-label={`Add task to ${column.name}`}
          onClick={() => onAddTask(column.id)}
          size="icon"
          title={`Add task to ${column.name}`}
          variant="ghost"
        >
          <Plus className="h-4 w-4" />
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={
              sorted
                ? `Sort ${column.name}: ${SORT_LABELS[sortMode as Exclude<ColumnSortMode, "manual">]} ${sortDir === "asc" ? "ascending" : "descending"}`
                : `Sort ${column.name}`
            }
            className={cn(
              "transition",
              sorted && "bg-sky-400/10 text-sky-200 hover:bg-sky-400/15",
              sortBlocked &&
                "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/50 hover:bg-amber-400/20",
            )}
            size="icon"
            title={
              sortBlocked
                ? "This column is sorted. Clear sorting to reorder tasks manually."
                : sorted
                  ? `Sorted by ${SORT_LABELS[sortMode as Exclude<ColumnSortMode, "manual">].toLowerCase()}`
                  : "Sort tasks"
            }
            variant="ghost"
          >
            {sorted ? (
              sortDir === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )
            ) : (
              <ArrowUpDown className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {SORT_MODES.map((mode) => {
            const isActive = sortMode === mode;
            return (
              <DropdownMenuItem
                className={
                  isActive
                    ? "bg-sky-400/15 text-sky-200 focus:bg-sky-400/25"
                    : undefined
                }
                key={mode}
                onSelect={(event) => {
                  event.preventDefault();
                  applySort(
                    mode,
                    isActive && sortDir === "asc" ? "desc" : "asc",
                  );
                }}
              >
                <span className="flex-1">{SORT_LABELS[mode]}</span>
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
              <DropdownMenuItem onSelect={() => applySort("manual")}>
                <X className="h-3.5 w-3.5" />
                <span>Clear sort</span>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`More actions for ${column.name}`}
            size="icon"
            title={`More actions for ${column.name}`}
            variant="ghost"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canWrite ? (
            <>
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setWipDialogOpen(true)}>
                Set WIP limit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onSelect={onCollapse}>
            <PanelLeftClose className="h-3.5 w-3.5" />
            Collapse column
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onHide}>
            <EyeOff className="h-3.5 w-3.5" />
            Hide column
          </DropdownMenuItem>
          {canWrite ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={otherColumns.length === 0}
                destructive
                onSelect={() => {
                  if (deletionTaskCount > 0) {
                    setConfirmDelete(true);
                  } else {
                    void remove({
                      kind: "column",
                      id: column.id,
                      name: column.name,
                    });
                  }
                }}
                title={
                  otherColumns.length === 0
                    ? "A board must have at least one column"
                    : undefined
                }
              >
                Delete column
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog onOpenChange={setWipDialogOpen} open={wipDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set a WIP limit</DialogTitle>
            <DialogDescription>
              Highlight this column when active work exceeds the limit. Leave it
              blank to remove the limit.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            inputMode="numeric"
            min={1}
            onChange={(event) => setWipLimitValue(event.target.value)}
            placeholder="No limit"
            type="number"
            value={wipLimit}
          />
          <DialogFooter>
            <Button onClick={() => setWipDialogOpen(false)} variant="ghost">
              Cancel
            </Button>
            <Button
              disabled={
                wipLimit.trim() !== "" &&
                (!Number.isInteger(Number(wipLimit)) ||
                  Number(wipLimit) < 1 ||
                  Number(wipLimit) > 999)
              }
              onClick={() => {
                setWipLimit.mutate({
                  boardId,
                  columnId: column.id,
                  wipLimit: wipLimit.trim() ? Number(wipLimit) : null,
                });
                setWipDialogOpen(false);
              }}
            >
              Save limit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{column.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This column has {deletionTaskCount}{" "}
              {deletionTaskCount === 1 ? "task" : "tasks"}
              {deletionTaskCount > taskCount ? ", including archived work" : ""}
              . Move {deletionTaskCount === 1 ? "it" : "them"} to another column
              before deleting. You can undo for a few seconds.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm">
            <span className="text-white/70">Move tasks to</span>
            <select
              className="h-9 w-full rounded-md border border-white/10 bg-[#14151c] px-3 text-sm outline-none focus:border-white/20 focus:ring-2 focus:ring-white/20"
              onChange={(event) => setDestinationColumnId(event.target.value)}
              value={destinationColumnId}
            >
              {otherColumns.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
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
                  moveTasksToColumnId: destinationColumnId,
                });
              }}
              disabled={!destinationColumnId}
              variant="destructive"
            >
              Move tasks and delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
