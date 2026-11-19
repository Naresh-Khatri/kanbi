"use client";

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  EyeIcon,
  EyeOffIcon,
  GaugeIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  MoveLeftIcon,
  MoveRightIcon,
  PanelLeftCloseIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuPopup,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastManager } from "@/components/ui/toast";
import type { ColumnSortDir, ColumnSortMode } from "@/lib/task-sort";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { useUndoableBoardDelete } from "../use-undoable-board-delete";
import type { ColumnRow } from "./board-types";
import { CONTEXT_MENU_PARTS, MENU_PARTS, type MenuParts } from "./menu-parts";
import { Tip } from "./tip";

const SORT_LABELS: Record<Exclude<ColumnSortMode, "manual">, string> = {
  priority: "Priority",
  assignee: "Assignee",
  dueAt: "Due date",
  createdAt: "Added date",
};

const SORT_MODES = Object.keys(SORT_LABELS) as Array<
  Exclude<ColumnSortMode, "manual">
>;

// revealed on column hover/focus; stays in dom for keyboard
const REVEAL =
  "opacity-0 transition-opacity in-[[data-slot=board-column]:hover]:opacity-100 in-[[data-slot=board-column]:focus-within]:opacity-100 pointer-coarse:opacity-100 data-popup-open:opacity-100";

type ColumnCategory = ColumnRow["category"];

const CATEGORY_META = {
  backlog: {
    label: "Backlog",
    Icon: CircleDashedIcon,
    className: "text-muted-foreground opacity-64",
  },
  unstarted: {
    label: "Todo",
    Icon: CircleIcon,
    className: "text-muted-foreground",
  },
  started: {
    label: "Started",
    Icon: CircleDotIcon,
    className: "text-info-foreground",
  },
  review: {
    label: "In review",
    Icon: EyeIcon,
    className: "text-warning-foreground",
  },
  completed: {
    label: "Completed",
    Icon: CheckCircle2Icon,
    className: "text-success-foreground",
  },
  canceled: {
    label: "Canceled",
    Icon: XCircleIcon,
    className: "text-muted-foreground opacity-64",
  },
} satisfies Record<
  ColumnCategory,
  { label: string; Icon: typeof CircleIcon; className: string }
>;

const CATEGORIES = Object.keys(CATEGORY_META) as ColumnCategory[];

type ColumnActions = {
  canWrite: boolean;
  category: ColumnCategory;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canDelete: boolean;
  isDefaultColumn: boolean;
  onRename: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onWipLimit: () => void;
  onCategoryChange: (category: ColumnCategory) => void;
  onCollapse: () => void;
  onHide: () => void;
  onDefaultColumnChange: (isDefault: boolean) => void;
  onDelete: () => void;
};

function ColumnActionItems({
  parts: P,
  actions: a,
}: {
  parts: MenuParts;
  actions: ColumnActions;
}) {
  return (
    <>
      {a.canWrite ? (
        <>
          <P.Item onClick={a.onRename}>
            <PencilIcon aria-hidden="true" />
            Rename
            <P.Shortcut>F2</P.Shortcut>
          </P.Item>
          <P.Item disabled={!a.canMoveLeft} onClick={a.onMoveLeft}>
            <MoveLeftIcon aria-hidden="true" />
            Move left
            <P.Shortcut>⌥←</P.Shortcut>
          </P.Item>
          <P.Item disabled={!a.canMoveRight} onClick={a.onMoveRight}>
            <MoveRightIcon aria-hidden="true" />
            Move right
            <P.Shortcut>⌥→</P.Shortcut>
          </P.Item>
          <P.Item onClick={a.onWipLimit}>
            <GaugeIcon aria-hidden="true" />
            Set WIP limit…
          </P.Item>
          <P.Sub>
            <P.SubTrigger>
              {(() => {
                const Current = CATEGORY_META[a.category].Icon;
                return <Current aria-hidden="true" />;
              })()}
              Status type
            </P.SubTrigger>
            <P.SubPopup>
              <P.RadioGroup
                onValueChange={(v) => a.onCategoryChange(v as ColumnCategory)}
                value={a.category}
              >
                {CATEGORIES.map((category) => {
                  const meta = CATEGORY_META[category];
                  return (
                    <P.RadioItem key={category} value={category}>
                      <span className="flex items-center gap-2">
                        <meta.Icon
                          aria-hidden="true"
                          className={meta.className}
                        />
                        {meta.label}
                      </span>
                    </P.RadioItem>
                  );
                })}
              </P.RadioGroup>
            </P.SubPopup>
          </P.Sub>
          <P.Separator />
        </>
      ) : null}
      <P.Item onClick={a.onCollapse}>
        <PanelLeftCloseIcon aria-hidden="true" />
        Collapse
      </P.Item>
      <P.Item onClick={a.onHide}>
        <EyeOffIcon aria-hidden="true" />
        Hide
      </P.Item>
      <P.CheckboxItem
        checked={a.isDefaultColumn}
        onCheckedChange={(checked) => a.onDefaultColumnChange(checked)}
      >
        Default for new tasks
      </P.CheckboxItem>
      {a.canWrite ? (
        <>
          <P.Separator />
          <P.Item
            disabled={!a.canDelete}
            onClick={a.onDelete}
            variant="destructive"
          >
            <Trash2Icon aria-hidden="true" />
            {a.canDelete ? "Delete column" : "Last column can't be deleted"}
          </P.Item>
        </>
      ) : null}
    </>
  );
}

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
  newCount = 0,
}: {
  boardId: string;
  column: ColumnRow;
  canWrite: boolean;
  taskCount: number;
  /** visible tasks with unseen activity */
  newCount?: number;
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
  const cancelRenameRef = useRef(false);

  const rename = api.column.rename.useMutation({
    onSuccess: async () => {
      setRenaming(false);
      await utils.board.get.invalidate({ boardId });
    },
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
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
      toastManager.add({
        type: "error",
        title: "Couldn't update the WIP limit",
      });
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
      toastManager.add({ type: "error", title: error.message });
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
      toastManager.add({ type: "error", title: "Column names can't be empty" });
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

  // menu returns focus to its trigger on close -> start rename after it settles
  const renameAfterClose = useRef(false);
  const requestRename = () => {
    renameAfterClose.current = true;
  };
  const onMenuOpenChangeComplete = (open: boolean) => {
    if (open || !renameAfterClose.current) return;
    renameAfterClose.current = false;
    startRenaming();
  };
  const finalFocus = () => !renameAfterClose.current;

  const actions: ColumnActions = {
    canWrite,
    category: column.category,
    canMoveLeft: columnIndex > 0,
    canMoveRight: columnIndex !== -1 && columnIndex < columns.length - 1,
    canDelete: otherColumns.length > 0,
    isDefaultColumn,
    onRename: requestRename,
    onMoveLeft,
    onMoveRight,
    onWipLimit: () => {
      setWipLimitValue(column.wipLimit?.toString() ?? "");
      setWipDialogOpen(true);
    },
    onCategoryChange: (category) =>
      setCategory.mutate({ boardId, columnId: column.id, category }),
    onCollapse,
    onHide,
    onDefaultColumnChange,
    onDelete: () => {
      if (deletionTaskCount > 0) {
        setDestinationColumnId(
          (current) => current || (otherColumns[0]?.id ?? ""),
        );
        setConfirmDelete(true);
      } else {
        void remove({ kind: "column", id: column.id, name: column.name });
      }
    },
  };

  const sortLabel = sorted
    ? SORT_LABELS[sortMode as Exclude<ColumnSortMode, "manual">]
    : null;
  const parsedWip = wipLimit.trim() === "" ? null : Number(wipLimit);
  const wipInvalid =
    parsedWip != null &&
    (!Number.isInteger(parsedWip) || parsedWip < 1 || parsedWip > 999);

  return (
    <>
      <ContextMenu onOpenChangeComplete={onMenuOpenChangeComplete}>
        <ContextMenuTrigger className="flex h-8 items-center gap-0.5 ps-1">
          {canWrite ? (
            <Button
              aria-label={`Drag ${column.name} column`}
              className={cn(
                REVEAL,
                "text-muted-foreground -ms-1 cursor-grab active:cursor-grabbing",
              )}
              size="icon-xs"
              type="button"
              variant="ghost"
              {...dragHandleProps}
            >
              <GripVerticalIcon aria-hidden="true" />
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
                aria-label="Column name"
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
                size="sm"
                value={name}
              />
            </form>
          ) : (
            <button
              className="focus-visible:ring-ring inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-1 text-start text-sm font-medium outline-none focus-visible:ring-2"
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
                aria-hidden="true"
                className={cn("size-3.5 shrink-0", categoryMeta.className)}
              />
              <span className="truncate">{column.name}</span>
              <span
                className={cn(
                  "text-muted-foreground ms-0.5 shrink-0 text-xs whitespace-nowrap tabular-nums",
                  overWipLimit && "text-warning-foreground",
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
              {newCount > 0 ? (
                <Badge
                  className="shrink-0 tabular-nums"
                  size="sm"
                  variant="info"
                >
                  {newCount} new
                </Badge>
              ) : null}
            </button>
          )}
          {canWrite ? (
            <Tip label="Add task">
              <Button
                aria-label={`Add task to ${column.name}`}
                className={cn(REVEAL, "text-muted-foreground")}
                onClick={() => onAddTask(column.id)}
                size="icon-xs"
                variant="ghost"
              >
                <PlusIcon aria-hidden="true" />
              </Button>
            </Tip>
          ) : null}
          <Menu>
            <Tip
              label={
                sortBlocked
                  ? "Sorted. Clear sorting to reorder manually"
                  : sortLabel
                    ? `Sorted by ${sortLabel.toLowerCase()}`
                    : "Sort tasks"
              }
            >
              <MenuTrigger
                render={
                  <Button
                    aria-label={
                      sortLabel
                        ? `Sort ${column.name}: ${sortLabel} ${sortDir === "asc" ? "ascending" : "descending"}`
                        : `Sort ${column.name}`
                    }
                    className={cn(
                      !sorted && cn(REVEAL, "text-muted-foreground"),
                      sorted && "bg-accent",
                      sortBlocked &&
                        "bg-warning/8 text-warning-foreground dark:bg-warning/16",
                    )}
                    size="icon-xs"
                    variant="ghost"
                  />
                }
              >
                {sorted ? (
                  sortDir === "asc" ? (
                    <ArrowUpIcon aria-hidden="true" />
                  ) : (
                    <ArrowDownIcon aria-hidden="true" />
                  )
                ) : (
                  <ArrowUpDownIcon aria-hidden="true" />
                )}
              </MenuTrigger>
            </Tip>
            <MenuPopup align="end">
              <MenuGroup>
                <MenuGroupLabel>Sort by</MenuGroupLabel>
                {SORT_MODES.map((mode) => {
                  const isActive = sortMode === mode;
                  return (
                    <MenuItem
                      className={cn(isActive && "bg-accent")}
                      closeOnClick={false}
                      key={mode}
                      onClick={() =>
                        applySort(
                          mode,
                          isActive && sortDir === "asc" ? "desc" : "asc",
                        )
                      }
                    >
                      <span className="flex-1">{SORT_LABELS[mode]}</span>
                      {isActive ? (
                        sortDir === "asc" ? (
                          <ArrowUpIcon aria-label="ascending" />
                        ) : (
                          <ArrowDownIcon aria-label="descending" />
                        )
                      ) : null}
                    </MenuItem>
                  );
                })}
              </MenuGroup>
              {sorted ? (
                <>
                  <MenuSeparator />
                  <MenuItem onClick={() => applySort("manual")}>
                    <XIcon aria-hidden="true" />
                    Clear sort
                  </MenuItem>
                </>
              ) : null}
            </MenuPopup>
          </Menu>
          <Menu onOpenChangeComplete={onMenuOpenChangeComplete}>
            <Tip label="Column actions">
              <MenuTrigger
                render={
                  <Button
                    aria-label={`More actions for ${column.name}`}
                    className={cn(REVEAL, "text-muted-foreground")}
                    size="icon-xs"
                    variant="ghost"
                  />
                }
              >
                <MoreHorizontalIcon aria-hidden="true" />
              </MenuTrigger>
            </Tip>
            <MenuPopup align="end" className="w-56" finalFocus={finalFocus}>
              <ColumnActionItems actions={actions} parts={MENU_PARTS} />
            </MenuPopup>
          </Menu>
        </ContextMenuTrigger>
        <ContextMenuPopup className="w-56" finalFocus={finalFocus}>
          <ColumnActionItems actions={actions} parts={CONTEXT_MENU_PARTS} />
        </ContextMenuPopup>
      </ContextMenu>
      <Dialog onOpenChange={setWipDialogOpen} open={wipDialogOpen}>
        <DialogPopup className="max-w-sm">
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              if (wipInvalid) return;
              setWipLimit.mutate({
                boardId,
                columnId: column.id,
                wipLimit: parsedWip,
              });
              setWipDialogOpen(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>Set a WIP limit</DialogTitle>
              <DialogDescription>
                Highlight this column when active work exceeds the limit. Leave
                it blank to remove the limit.
              </DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <Field>
                <FieldLabel>Max tasks</FieldLabel>
                <NumberField
                  max={999}
                  min={1}
                  onValueChange={(v) =>
                    setWipLimitValue(v == null ? "" : String(v))
                  }
                  value={parsedWip}
                >
                  <NumberFieldGroup>
                    <NumberFieldDecrement />
                    <NumberFieldInput autoFocus placeholder="No limit" />
                    <NumberFieldIncrement />
                  </NumberFieldGroup>
                </NumberField>
              </Field>
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" />}>
                Cancel
              </DialogClose>
              <Button disabled={wipInvalid} type="submit">
                Save limit
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
      <AlertDialog onOpenChange={setConfirmDelete} open={confirmDelete}>
        <AlertDialogPopup className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{column.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This column has {deletionTaskCount}{" "}
              {deletionTaskCount === 1 ? "task" : "tasks"}
              {deletionTaskCount > taskCount ? ", including archived work" : ""}
              . Move {deletionTaskCount === 1 ? "it" : "them"} to another column
              first. You can undo for a few seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Field>
              <FieldLabel>Move tasks to</FieldLabel>
              <Select
                items={otherColumns.map((c) => ({
                  label: c.name,
                  value: c.id,
                }))}
                onValueChange={(v) =>
                  setDestinationColumnId((v as string) ?? "")
                }
                value={destinationColumnId}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {otherColumns.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </Field>
          </div>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>
              Cancel
            </AlertDialogClose>
            <Button
              disabled={!destinationColumnId}
              onClick={() => {
                setConfirmDelete(false);
                void remove({
                  kind: "column",
                  id: column.id,
                  name: column.name,
                  moveTasksToColumnId: destinationColumnId,
                });
              }}
              variant="destructive"
            >
              Move tasks and delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
