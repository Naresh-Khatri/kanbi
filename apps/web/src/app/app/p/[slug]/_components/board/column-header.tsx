"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleDot,
  GripVertical,
  EyeOff,
  MoveLeft,
  MoveRight,
  PanelLeftClose,
  MoreHorizontal,
  Plus,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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

type ColumnCategory = ColumnRow["category"];

const CATEGORY_META = {
  backlog: {
    label: "Backlog",
    Icon: CircleDashed,
    className: "text-white/40",
  },
  unstarted: {
    label: "Unstarted",
    Icon: Circle,
    className: "text-white/70",
  },
  started: {
    label: "Started",
    Icon: CircleDot,
    className: "text-info",
  },
  completed: {
    label: "Completed",
    Icon: CheckCircle2,
    className: "text-success",
  },
  canceled: {
    label: "Canceled",
    Icon: XCircle,
    className: "text-white/40",
  },
} satisfies Record<
  ColumnCategory,
  { label: string; Icon: typeof Circle; className: string }
>;

const CATEGORIES = Object.keys(CATEGORY_META) as ColumnCategory[];

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
  onMoveLeft,
  onMoveRight,
  isDefaultColumn,
  onDefaultColumnChange,
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
  onMoveLeft: () => void;
  onMoveRight: () => void;
  isDefaultColumn: boolean;
  onDefaultColumnChange: (isDefault: boolean) => void;
}) {
  const utils = api.useUtils();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const cancelRenameRef = useRef(false);

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
  const columnIndex = columns.findIndex(
    (candidate) => candidate.id === column.id,
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
  const setCategory = api.column.setCategory.useMutation({
    onMutate: async (vars) => {
      await utils.board.get.cancel({ boardId });
      const previous = utils.board.get.getData({ boardId });
      utils.board.get.setData({ boardId }, (old) =>
        old
          ? {
              ...old,
              columns: old.columns.map((candidate) =>
                candidate.id === vars.columnId
                  ? { ...candidate, category: vars.category }
                  : candidate,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        utils.board.get.setData({ boardId }, context.previous);
      }
      toast.error(error.message);
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
  const categoryMeta = CATEGORY_META[column.category];

  useEffect(() => {
    if (!renaming) setName(column.name);
  }, [column.name, renaming]);

  function startRenaming() {
    cancelRenameRef.current = false;
    setName(column.name);
    setRenaming(true);
  }

  function cancelRenaming() {
    cancelRenameRef.current = true;
    setName(column.name);
    setRenaming(false);
  }

  function commitRename() {
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    if (rename.isPending) return;
    const nextName = name.trim();
    if (!nextName) {
      toast.error("Column names can't be empty");
      return;
    }
    if (nextName === column.name) {
      cancelRenaming();
      return;
    }
    cancelRenameRef.current = true;
    setRenaming(false);
    rename.mutate({ boardId, columnId: column.id, name: nextName });
  }

  return (
    <div
      className="flex items-center gap-1 px-1"
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
    >
      {canWrite ? (
        <Button
          aria-label={`Drag ${column.name} column`}
          className="cursor-grab active:cursor-grabbing"
          size="icon-sm"
          type="button"
          variant="quiet"
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </Button>
      ) : null}
      {renaming ? (
        <form
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            commitRename();
          }}
        >
          <Input
            autoFocus
            disabled={rename.isPending}
            onBlur={commitRename}
            onChange={(e) => setName(e.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelRenaming();
              }
            }}
            value={name}
          />
        </form>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            className="inline-flex min-w-0 items-center gap-1.5 truncate text-left text-sm font-medium"
            disabled={!canWrite}
            onDoubleClick={startRenaming}
            onKeyDown={(event) => {
              if (event.key === "F2") {
                event.preventDefault();
                startRenaming();
              } else if (event.altKey && event.key === "ArrowLeft") {
                event.preventDefault();
                onMoveLeft();
              } else if (event.altKey && event.key === "ArrowRight") {
                event.preventDefault();
                onMoveRight();
              }
            }}
            title="Double-click or press F2 to rename"
            type="button"
          >
            <categoryMeta.Icon
              aria-hidden
              className={cn("h-3.5 w-3.5 shrink-0", categoryMeta.className)}
            />
            <span className="truncate">{column.name}</span>
            <span
              className={cn(
                "ml-2 text-xs text-white/40",
                overWipLimit && "text-warning",
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
            size="icon"
            title={
              sortBlocked
                ? "This column is sorted. Clear sorting to reorder tasks manually."
                : sorted
                  ? `Sorted by ${SORT_LABELS[sortMode as Exclude<ColumnSortMode, "manual">].toLowerCase()}`
                  : "Sort tasks"
            }
            variant={
              sortBlocked ? "selected-warning" : sorted ? "selected" : "ghost"
            }
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
                  isActive ? "bg-info/15 text-info focus:bg-info/20" : undefined
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
      <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
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
              <DropdownMenuItem onSelect={startRenaming}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={columnIndex <= 0}
                onSelect={onMoveLeft}
              >
                <MoveLeft className="h-3.5 w-3.5" />
                Move left
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={
                  columnIndex === -1 || columnIndex >= columns.length - 1
                }
                onSelect={onMoveRight}
              >
                <MoveRight className="h-3.5 w-3.5" />
                Move right
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setWipLimitValue(column.wipLimit?.toString() ?? "");
                  setWipDialogOpen(true);
                }}
              >
                Set WIP limit
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Status type</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {CATEGORIES.map((category) => {
                    const meta = CATEGORY_META[category];
                    return (
                      <DropdownMenuItem
                        key={category}
                        onSelect={() =>
                          setCategory.mutate({
                            boardId,
                            columnId: column.id,
                            category,
                          })
                        }
                      >
                        <meta.Icon
                          className={cn("h-3.5 w-3.5", meta.className)}
                        />
                        <span className="flex-1">{meta.label}</span>
                        {column.category === category ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : null}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
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
          <DropdownMenuItem
            onSelect={() => onDefaultColumnChange(!isDefaultColumn)}
          >
            <span className="flex-1">Default for new tasks</span>
            {isDefaultColumn ? <Check className="h-3.5 w-3.5" /> : null}
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
            <Select
              className="w-full"
              size="sm"
              onChange={(event) => setDestinationColumnId(event.target.value)}
              value={destinationColumnId}
            >
              {otherColumns.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </Select>
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
