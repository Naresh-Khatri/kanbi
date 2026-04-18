"use client";

import {
  type CollisionDetection,
  closestCenter,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import confetti from "canvas-confetti";
import { GripVertical, MoreHorizontal, Plus } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppShell } from "@/components/keybinds/shell-store";
import { isDoneLikeColumn } from "@/lib/column-heuristics";
import { positionBetween } from "@/lib/position";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { api, type RouterOutputs } from "@/trpc/react";
import { PRIORITY_META, type Priority, PriorityIcon } from "./priority";
import { QuickAddTaskDialog } from "./quick-add-task-dialog";
import { ShareDialog } from "./share-dialog";
import { TaskDetailSheet } from "./task-detail-sheet";

type BoardData = RouterOutputs["board"]["get"];
type TaskRow = BoardData["tasks"][number];
type ColumnRow = BoardData["columns"][number];

type ActiveDrag =
  | { kind: "task"; task: TaskRow }
  | { kind: "column"; column: ColumnRow }
  | null;

type DropTarget = { columnId: string; beforeTaskId: string | null } | null;

function celebrate() {
  const end = Date.now() + 700;
  const colors = ["#38bdf8", "#a78bfa", "#f472b6", "#fbbf24", "#34d399"];
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      startVelocity: 45,
      origin: { x: 0, y: 0.9 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      startVelocity: 45,
      origin: { x: 1, y: 0.9 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function BoardView({
  boardId,
  projectId,
  projectName,
}: {
  boardId: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
}) {
  const [data] = api.board.get.useSuspenseQuery({ boardId });
  const membersQuery = api.project.members.useQuery({ projectId });
  const membersById = useMemo(() => {
    const map = new Map<string, { name: string; image: string | null }>();
    for (const m of membersQuery.data ?? []) {
      map.set(m.userId, { name: m.name, image: m.image });
    }
    return map;
  }, [membersQuery.data]);
  const utils = api.useUtils();
  const { columns, tasks, labels, taskLabels, access } = data;
  const canWrite = access.canWrite;
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null);
  const createTaskToken = useAppShell((s) => s.createTaskToken);
  const setHeaderSlot = useAppShell((s) => s.setHeaderSlot);
  const clearHeaderSlot = useAppShell((s) => s.clearHeaderSlot);
  useEffect(() => {
    if (createTaskToken > 0 && columns.length > 0) {
      setQuickAddColumnId(null);
      setQuickAddOpen(true);
    }
  }, [createTaskToken, columns.length]);

  useEffect(() => {
    setHeaderSlot({
      left: (
        <h1 className="truncate font-medium text-sm text-white">
          {projectName}
        </h1>
      ),
      right: access.canAdmin ? (
        <ShareDialog boardId={boardId} projectId={projectId} />
      ) : null,
    });
    return () => clearHeaderSlot();
  }, [
    setHeaderSlot,
    clearHeaderSlot,
    projectName,
    access.canAdmin,
    boardId,
    projectId,
  ]);

  const openTask = openTaskId
    ? (tasks.find((t) => t.id === openTaskId) ?? null)
    : null;

  api.realtime.onBoardChange.useSubscription(
    { boardId },
    {
      onData: (evt) => {
        if (evt.scope === "comment") {
          utils.comment.list.invalidate();
          utils.activity.list.invalidate();
          return;
        }
        if (evt.scope === "checklist") {
          utils.checklist.list.invalidate();
          return;
        }
        if (evt.scope === "attachment") {
          utils.attachment.list.invalidate();
          return;
        }
        if (evt.scope === "activity") {
          utils.activity.list.invalidate();
          return;
        }
        utils.board.get.invalidate({ boardId });
      },
    },
  );

  const moveTask = api.task.move.useMutation({
    onMutate: async (vars) => {
      await utils.board.get.cancel({ boardId });
      const previous = utils.board.get.getData({ boardId });
      utils.board.get.setData({ boardId }, (old) => {
        if (!old) return old;
        const nextPosition = positionBetween(vars.before, vars.after);
        return {
          ...old,
          tasks: old.tasks.map((t) =>
            t.id === vars.taskId
              ? { ...t, columnId: vars.toColumnId, position: nextPosition }
              : t,
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.board.get.setData({ boardId }, ctx.previous);
    },
    onSettled: () => utils.board.get.invalidate({ boardId }),
  });
  const reorderColumn = api.column.reorder.useMutation({
    onMutate: async (vars) => {
      await utils.board.get.cancel({ boardId });
      const previous = utils.board.get.getData({ boardId });
      utils.board.get.setData({ boardId }, (old) => {
        if (!old) return old;
        const nextPosition = positionBetween(vars.before, vars.after);
        return {
          ...old,
          columns: old.columns.map((c) =>
            c.id === vars.columnId ? { ...c, position: nextPosition } : c,
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.board.get.setData({ boardId }, ctx.previous);
    },
    onSettled: () => utils.board.get.invalidate({ boardId }),
  });

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const c of columns) map.set(c.id, []);
    for (const t of tasks) {
      if (t.archivedAt) continue;
      const list = map.get(t.columnId);
      if (list) list.push(t);
    }
    return map;
  }, [columns, tasks]);

  const [active, setActive] = useState<ActiveDrag>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

  const collisionDetection: CollisionDetection = (args) => {
    if (active?.kind === "column") {
      const columnIds = new Set(columns.map((c) => c.id));
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((d) =>
          columnIds.has(String(d.id)),
        ),
      });
    }
    return closestCorners(args);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    const kind = e.active.data.current?.kind as "task" | "column" | undefined;
    if (kind === "task") {
      const t = tasks.find((x) => x.id === id);
      if (t) setActive({ kind: "task", task: t });
    } else if (kind === "column") {
      const c = columns.find((x) => x.id === id);
      if (c) setActive({ kind: "column", column: c });
    }
  }

  function onDragOver(e: DragOverEvent) {
    const { active: a, over } = e;
    if (!over) {
      setDropTarget(null);
      return;
    }
    const activeKind = a.data.current?.kind as "task" | "column" | undefined;
    if (activeKind !== "task") return;
    const overKind = over.data.current?.kind as "task" | "column" | undefined;
    const columnId =
      (over.data.current?.columnId as string | undefined) ?? String(over.id);
    if (!columnId) {
      setDropTarget(null);
      return;
    }
    const beforeTaskId =
      overKind === "task" && String(over.id) !== String(a.id)
        ? String(over.id)
        : null;
    setDropTarget({ columnId, beforeTaskId });
  }

  function onDragCancel() {
    setActive(null);
    setDropTarget(null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    setDropTarget(null);
    const { active: a, over } = e;
    if (!over) return;
    const activeKind = a.data.current?.kind as "task" | "column" | undefined;

    if (activeKind === "column") {
      const overColumnId =
        (over.data.current?.columnId as string | undefined) ?? String(over.id);
      if (!overColumnId || overColumnId === a.id) return;

      const sorted = [...columns].sort((x, y) => x.position - y.position);
      const fromIdx = sorted.findIndex((c) => c.id === a.id);
      const toIdx = sorted.findIndex((c) => c.id === overColumnId);
      if (fromIdx === -1 || toIdx === -1) return;
      const without = sorted.filter((c) => c.id !== a.id);
      const insertAt = toIdx;
      const before = without[insertAt - 1]?.position ?? null;
      const after = without[insertAt]?.position ?? null;
      reorderColumn.mutate({
        boardId,
        columnId: String(a.id),
        before,
        after,
      });
      return;
    }

    if (activeKind === "task") {
      const overKind = over.data.current?.kind as "task" | "column" | undefined;
      const targetColumnId =
        (over.data.current?.columnId as string | undefined) ?? String(over.id);
      if (!targetColumnId) return;

      const activeTask = tasks.find((t) => t.id === a.id);
      if (!activeTask) return;

      const columnTasks = [...(tasksByColumn.get(targetColumnId) ?? [])].filter(
        (t) => t.id !== a.id,
      );

      let before: number | null = null;
      let after: number | null = null;

      if (overKind === "task") {
        const overIdx = columnTasks.findIndex((t) => t.id === over.id);
        if (overIdx === -1) {
          before = columnTasks[columnTasks.length - 1]?.position ?? null;
        } else {
          // Place above the hovered task by default
          before = columnTasks[overIdx - 1]?.position ?? null;
          after = columnTasks[overIdx]?.position ?? null;
        }
      } else {
        before = columnTasks[columnTasks.length - 1]?.position ?? null;
      }

      if (
        activeTask.columnId === targetColumnId &&
        before === activeTask.position
      ) {
        return;
      }

      moveTask.mutate({
        boardId,
        taskId: activeTask.id,
        toColumnId: targetColumnId,
        before,
        after,
      });

      if (activeTask.columnId !== targetColumnId) {
        const targetColumn = columns.find((c) => c.id === targetColumnId);
        if (targetColumn && isDoneLikeColumn(targetColumn.name)) {
          celebrate();
        }
      }
    }
  }

  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns],
  );

  return (
    <main className="flex h-[calc(100vh-57px)] flex-col">
      <DndContext
        collisionDetection={collisionDetection}
        onDragCancel={canWrite ? onDragCancel : undefined}
        onDragEnd={canWrite ? onDragEnd : undefined}
        onDragOver={canWrite ? onDragOver : undefined}
        onDragStart={canWrite ? onDragStart : undefined}
        sensors={sensors}
      >
        <div className="flex-1 overflow-x-auto">
          <div className="flex h-full min-w-max gap-4 p-6">
            <SortableContext
              items={sortedColumns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {sortedColumns.map((col) => (
                <SortableColumn
                  boardId={boardId}
                  canWrite={canWrite}
                  column={col}
                  dropTarget={
                    dropTarget?.columnId === col.id ? dropTarget : null
                  }
                  key={col.id}
                  membersById={membersById}
                  onAddTask={(id) => {
                    setQuickAddColumnId(id);
                    setQuickAddOpen(true);
                  }}
                  onOpenTask={setOpenTaskId}
                  tasks={tasksByColumn.get(col.id) ?? []}
                />
              ))}
            </SortableContext>
            {canWrite ? <AddColumn boardId={boardId} /> : null}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {active?.kind === "task" ? (
            <TaskCardPreview task={active.task} />
          ) : active?.kind === "column" ? (
            <div className="w-72 rounded-xl bg-white/[0.06] p-3 shadow-xl">
              <div className="font-medium text-sm">{active.column.name}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <TaskDetailSheet
        boardId={boardId}
        canWrite={canWrite}
        labels={labels}
        onOpenChange={(o) => {
          if (!o) setOpenTaskId(null);
        }}
        open={!!openTask}
        projectId={projectId}
        task={openTask}
        taskLabels={taskLabels}
      />
      {columns.length > 0 ? (
        <QuickAddTaskDialog
          boardId={boardId}
          columns={columns}
          initialColumnId={quickAddColumnId}
          labels={labels}
          onOpenChange={setQuickAddOpen}
          open={quickAddOpen}
          projectId={projectId}
        />
      ) : null}
    </main>
  );
}

function SortableColumn({
  boardId,
  column,
  tasks,
  canWrite,
  dropTarget,
  onOpenTask,
  onAddTask,
  membersById,
}: {
  boardId: string;
  column: ColumnRow;
  tasks: TaskRow[];
  canWrite: boolean;
  dropTarget: DropTarget;
  onOpenTask: (taskId: string) => void;
  onAddTask: (columnId: string) => void;
  membersById: Map<string, { name: string; image: string | null }>;
}) {
  const sortable = useSortable({
    id: column.id,
    data: { kind: "column" },
    disabled: !canWrite,
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `col-drop-${column.id}`,
    data: { kind: "column", columnId: column.id },
  });

  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  return (
    <div
      className="flex w-72 shrink-0 flex-col gap-3 rounded-xl bg-white/[0.03] p-3"
      ref={sortable.setNodeRef}
      style={style}
    >
      <ColumnHeader
        boardId={boardId}
        canWrite={canWrite}
        column={column}
        dragHandleProps={{
          ...sortable.attributes,
          ...sortable.listeners,
        }}
        taskCount={tasks.length}
      />
      <div className="flex flex-col gap-2" ref={setDropRef}>
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((t) => (
            <Fragment key={t.id}>
              {dropTarget?.beforeTaskId === t.id ? <DropIndicator /> : null}
              <SortableTaskCard
                assignee={
                  t.assigneeId ? (membersById.get(t.assigneeId) ?? null) : null
                }
                boardId={boardId}
                canWrite={canWrite}
                columnId={column.id}
                onOpen={() => onOpenTask(t.id)}
                task={t}
              />
            </Fragment>
          ))}
        </SortableContext>
        {dropTarget && dropTarget.beforeTaskId === null && tasks.length > 0 ? (
          <DropIndicator />
        ) : null}
        {tasks.length === 0 && dropTarget ? (
          <div className="h-16 rounded-md border border-white/40 border-dashed bg-white/[0.04]" />
        ) : null}
      </div>
      {canWrite ? (
        <Button
          className="justify-start text-white/70"
          onClick={() => onAddTask(column.id)}
          size="sm"
          variant="ghost"
        >
          <Plus className="h-4 w-4" /> Add task
        </Button>
      ) : null}
    </div>
  );
}

function ColumnHeader({
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
  const remove = api.column.delete.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-1 px-1">
      {canWrite ? (
        <button
          aria-label="Drag column"
          className="cursor-grab text-white/40 hover:text-white/80 active:cursor-grabbing p-2"
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
        <button
          className="flex-1 text-left font-medium text-sm"
          disabled={!canWrite}
          onClick={() => setRenaming(true)}
          type="button"
        >
          {column.name}
          <span className="ml-2 text-white/40 text-xs">{taskCount}</span>
        </button>
      )}
      {canWrite ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              destructive
              onSelect={() => remove.mutate({ boardId, columnId: column.id })}
            >
              Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function SortableTaskCard({
  boardId,
  task,
  columnId,
  canWrite,
  onOpen,
  assignee,
}: {
  boardId: string;
  task: TaskRow;
  columnId: string;
  canWrite: boolean;
  onOpen: () => void;
  assignee: { name: string; image: string | null } | null;
}) {
  const sortable = useSortable({
    id: task.id,
    data: { kind: "task", columnId },
    disabled: !canWrite,
  });

  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <TaskCard
        assignee={assignee}
        boardId={boardId}
        onOpen={onOpen}
        task={task}
      />
    </div>
  );
}

function DropIndicator() {
  return (
    <div className="h-0.5 rounded-full bg-sky-400/80 shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
  );
}

function TaskCardPreview({ task }: { task: TaskRow }) {
  return (
    <div className="w-72 rotate-2 rounded-lg border border-white/10 bg-[#14151c] p-3 shadow-xl">
      <p className="text-sm leading-snug">{task.title}</p>
    </div>
  );
}

function TaskCard({
  boardId,
  task,
  onOpen,
  assignee,
}: {
  boardId: string;
  task: TaskRow;
  onOpen: () => void;
  assignee: { name: string; image: string | null } | null;
}) {
  const utils = api.useUtils();
  const remove = api.task.delete.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
  });
  return (
    <div
      className="group w-full cursor-pointer rounded-lg border border-white/10 bg-[#14151c] p-3 transition hover:border-white/20"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug">{task.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="opacity-0 group-hover:opacity-100"
              onPointerDown={(e) => e.stopPropagation()}
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              destructive
              onSelect={() => remove.mutate({ boardId, taskId: task.id })}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {task.priority !== "none" ? (
          <div
            className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] tracking-wide"
            style={{
              borderColor: `${PRIORITY_META[task.priority as Priority].color}55`,
              color: PRIORITY_META[task.priority as Priority].color,
            }}
          >
            <PriorityIcon
              className="h-3 w-3"
              priority={task.priority as Priority}
            />
            {PRIORITY_META[task.priority as Priority].label}
          </div>
        ) : (
          <span />
        )}
        {assignee ? (
          <UserAvatar image={assignee.image} name={assignee.name} size={20} />
        ) : null}
      </div>
    </div>
  );
}

function AddColumn({ boardId }: { boardId: string }) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = api.column.create.useMutation({
    onSuccess: async () => {
      setOpen(false);
      setName("");
      await utils.board.get.invalidate({ boardId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button
        className="h-10 w-72 shrink-0 justify-start"
        onClick={() => setOpen(true)}
        variant="outline"
      >
        <Plus className="h-4 w-4" /> Add column
      </Button>
    );
  }
  return (
    <form
      className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-white/[0.03] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        create.mutate({ boardId, name: name.trim() });
      }}
    >
      <Input
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Column name"
        value={name}
      />
      <div className="flex gap-2">
        <Button disabled={create.isPending} size="sm" type="submit">
          Add
        </Button>
        <Button
          onClick={() => setOpen(false)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
