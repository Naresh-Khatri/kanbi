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
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useAppShell } from "@/components/keybinds/shell-store";
import { isDoneLikeColumn } from "@/lib/column-heuristics";
import { positionBetween } from "@/lib/position";
import {
  type ColumnSortDir,
  type ColumnSortMode,
  compareTasks,
} from "@/lib/task-sort";
import { api } from "@/trpc/react";
import { AddColumn } from "./add-column";
import { ArchivePanel } from "./archive-panel";
import { AiDraftDialog } from "../ai-draft-dialog";
import {
  type BoardFilters,
  BoardToolbar,
  EMPTY_FILTERS,
  hasActiveFilters,
  taskMatchesFilters,
} from "../board-toolbar";
import type {
  ActiveDrag,
  DropTarget,
  LabelInfo,
  MemberInfo,
  TaskRow,
} from "./board-types";
import { celebrate } from "./celebrate";
import { QuickAddTaskDialog } from "../quick-add-task-dialog";
import { useArchiveTask } from "../use-archive-task";
import { SortableColumn } from "./sortable-column";
import { StatsBar } from "./stats-bar";
import { TaskCardPreview } from "./task-card";
import { TaskDetailSheet } from "../task-detail-sheet";

export function BoardView({
  boardId,
  projectId,
}: {
  boardId: string;
  projectId: string;
  projectSlug: string;
}) {
  const [data] = api.board.get.useSuspenseQuery({ boardId });
  const membersQuery = api.project.members.useQuery({ projectId });
  const members = membersQuery.data ?? [];
  const membersById = useMemo(() => {
    const map = new Map<string, MemberInfo>();
    for (const m of members) {
      map.set(m.userId, { name: m.name, image: m.image });
    }
    return map;
  }, [members]);
  const utils = api.useUtils();
  const { columns, tasks, labels, taskLabels, access } = data;
  const canWrite = access.canWrite;
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  useEffect(() => {
    const taskId = new URLSearchParams(window.location.search).get("task");
    if (taskId) setOpenTaskId(taskId);
  }, []);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const archiveTask = useArchiveTask(boardId);
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [aiDraftColumnId, setAiDraftColumnId] = useState<string | null>(null);
  const createTaskToken = useAppShell((s) => s.createTaskToken);
  const aiImportToken = useAppShell((s) => s.aiImportToken);
  const lastCreateTaskToken = useRef(createTaskToken);
  const lastAiImportToken = useRef(aiImportToken);
  useEffect(() => {
    if (createTaskToken === lastCreateTaskToken.current) return;
    lastCreateTaskToken.current = createTaskToken;
    if (columns.length > 0) {
      setQuickAddColumnId(null);
      setQuickAddOpen(true);
    }
  }, [createTaskToken, columns.length]);
  useEffect(() => {
    if (aiImportToken === lastAiImportToken.current) return;
    lastAiImportToken.current = aiImportToken;
    if (columns.length > 0 && canWrite) {
      setAiDraftColumnId(null);
      setAiDraftOpen(true);
    }
  }, [aiImportToken, columns.length, canWrite]);

  useHotkeys(
    "shift+v",
    (e) => {
      if (!canWrite || columns.length === 0) return;
      e.preventDefault();
      setAiDraftColumnId(null);
      setAiDraftOpen(true);
    },
    { enableOnFormTags: false },
    [canWrite, columns.length],
  );

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

  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useHotkeys(
    "/",
    (e) => {
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
    { preventDefault: true },
  );

  const labelsByTask = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const tl of taskLabels) {
      const set = map.get(tl.taskId) ?? new Set<string>();
      set.add(tl.labelId);
      map.set(tl.taskId, set);
    }
    return map;
  }, [taskLabels]);

  const cardLabelsByTask = useMemo(() => {
    const byId = new Map(labels.map((l) => [l.id, l]));
    const map = new Map<string, LabelInfo[]>();
    for (const tl of taskLabels) {
      const l = byId.get(tl.labelId);
      if (!l) continue;
      const list = map.get(tl.taskId) ?? [];
      list.push({ id: l.id, name: l.name, color: l.color });
      map.set(tl.taskId, list);
    }
    return map;
  }, [labels, taskLabels]);

  const archivedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.archivedAt)
        .sort(
          (a, b) =>
            (b.archivedAt?.getTime() ?? 0) - (a.archivedAt?.getTime() ?? 0),
        ),
    [tasks],
  );
  const columnNameById = useMemo(
    () => new Map(columns.map((c) => [c.id, c.name])),
    [columns],
  );

  const filtersActive = hasActiveFilters(filters);

  const { tasksByColumn, visibleCount, totalCount } = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const c of columns) map.set(c.id, []);
    let visible = 0;
    let total = 0;
    const empty = new Set<string>();
    for (const t of tasks) {
      if (t.archivedAt) continue;
      total++;
      if (
        filtersActive &&
        !taskMatchesFilters(t, labelsByTask.get(t.id) ?? empty, filters)
      ) {
        continue;
      }
      const list = map.get(t.columnId);
      if (list) {
        list.push(t);
        visible++;
      }
    }
    const nameOf = (id: string) => membersById.get(id)?.name;
    for (const c of columns) {
      const list = map.get(c.id);
      if (!list) continue;
      list.sort(
        compareTasks(
          c.sortMode as ColumnSortMode,
          c.sortDir as ColumnSortDir,
          nameOf,
        ),
      );
    }
    return { tasksByColumn: map, visibleCount: visible, totalCount: total };
  }, [columns, tasks, filters, filtersActive, labelsByTask, membersById]);

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

  function isDropAfter(
    a: DragOverEvent["active"] | DragEndEvent["active"],
    over: NonNullable<DragOverEvent["over"] | DragEndEvent["over"]>,
  ) {
    const activeRect = a.rect.current.translated;
    const overRect = over.rect;
    if (!activeRect || !overRect) return false;
    return (
      activeRect.top + activeRect.height / 2 >
      overRect.top + overRect.height / 2
    );
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
    let beforeTaskId: string | null = null;
    if (overKind === "task" && String(over.id) !== String(a.id)) {
      if (isDropAfter(a, over)) {
        const list = (tasksByColumn.get(columnId) ?? []).filter(
          (t) => t.id !== a.id,
        );
        const idx = list.findIndex((t) => t.id === over.id);
        beforeTaskId = list[idx + 1]?.id ?? null;
      } else {
        beforeTaskId = String(over.id);
      }
    }
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

      const sourceColumn = columns.find((c) => c.id === activeTask.columnId);
      if (
        sourceColumn?.sortMode !== "manual" &&
        activeTask.columnId === targetColumnId
      ) {
        toast("Clear sort to reorder tasks within this column");
        return;
      }

      const columnTasks = [...(tasksByColumn.get(targetColumnId) ?? [])].filter(
        (t) => t.id !== a.id,
      );

      let before: number | null = null;
      let after: number | null = null;

      if (overKind === "task") {
        const overIdx = columnTasks.findIndex((t) => t.id === over.id);
        if (overIdx === -1) {
          before = columnTasks[columnTasks.length - 1]?.position ?? null;
        } else if (isDropAfter(a, over)) {
          before = columnTasks[overIdx]?.position ?? null;
          after = columnTasks[overIdx + 1]?.position ?? null;
        } else {
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

  const stats = useMemo(() => {
    const now = Date.now();
    const doneColumnIds = new Set(
      columns.filter((c) => isDoneLikeColumn(c.name)).map((c) => c.id),
    );
    let total = 0;
    let done = 0;
    let overdue = 0;
    let unassigned = 0;
    let highPriority = 0;
    for (const t of tasks) {
      if (t.archivedAt) continue;
      total++;
      const isDone = doneColumnIds.has(t.columnId);
      if (isDone) done++;
      if (!isDone && t.dueAt && t.dueAt.getTime() < now) overdue++;
      if (!t.assigneeId) unassigned++;
      if (!isDone && (t.priority === "high" || t.priority === "urgent")) {
        highPriority++;
      }
    }
    return { total, done, overdue, unassigned, highPriority };
  }, [columns, tasks]);

  function handleOpenTask(taskId: string) {
    setFocusedTaskId(taskId);
    setOpenTaskId(taskId);
  }

  // Card-level keyboard navigation. The hotkey handlers read the latest board
  // state through a ref, so the bindings can stay stable and the handlers don't
  // capture stale columns/tasks.
  const navColumns = useMemo(
    () =>
      sortedColumns.map((c) => ({
        id: c.id,
        taskIds: (tasksByColumn.get(c.id) ?? []).map((t) => t.id),
      })),
    [sortedColumns, tasksByColumn],
  );
  const navActive = !openTask && !quickAddOpen && !aiDraftOpen && !archiveOpen;
  const kbRef = useRef({
    navColumns,
    focusedTaskId,
    active: navActive,
    canWrite,
    tasks,
    archive: archiveTask,
  });
  kbRef.current = {
    navColumns,
    focusedTaskId,
    active: navActive,
    canWrite,
    tasks,
    archive: archiveTask,
  };

  function moveFocus(dir: "up" | "down" | "left" | "right") {
    const { navColumns: cols, focusedTaskId: fid } = kbRef.current;
    const firstNonEmpty = cols.find((c) => c.taskIds.length > 0);
    if (!firstNonEmpty) return;
    let ci = fid ? cols.findIndex((c) => c.taskIds.includes(fid)) : -1;
    if (ci === -1) {
      setFocusedTaskId(firstNonEmpty.taskIds[0] ?? null);
      return;
    }
    let ti = cols[ci]!.taskIds.indexOf(fid!);
    if (dir === "down") {
      ti = Math.min(ti + 1, cols[ci]!.taskIds.length - 1);
    } else if (dir === "up") {
      ti = Math.max(ti - 1, 0);
    } else {
      const step = dir === "right" ? 1 : -1;
      let nci = ci + step;
      while (nci >= 0 && nci < cols.length && cols[nci]!.taskIds.length === 0) {
        nci += step;
      }
      if (nci < 0 || nci >= cols.length) return;
      ci = nci;
      ti = Math.min(ti, cols[ci]!.taskIds.length - 1);
    }
    const next = cols[ci]?.taskIds[ti];
    if (next) setFocusedTaskId(next);
  }

  function archiveFocused() {
    const { focusedTaskId: fid, canWrite: cw, tasks: ts, navColumns: cols } =
      kbRef.current;
    if (!fid || !cw) return;
    const target = ts.find((t) => t.id === fid);
    if (!target) return;
    const col = cols.find((c) => c.taskIds.includes(fid));
    let nextFocus: string | null = null;
    if (col) {
      const idx = col.taskIds.indexOf(fid);
      nextFocus = col.taskIds[idx + 1] ?? col.taskIds[idx - 1] ?? null;
    }
    kbRef.current.archive({ id: target.id, title: target.title });
    setFocusedTaskId(nextFocus);
  }

  const cardKeyOpts = { enableOnFormTags: false } as const;
  useHotkeys(
    "down",
    (e) => {
      if (!kbRef.current.active) return;
      e.preventDefault();
      moveFocus("down");
    },
    cardKeyOpts,
  );
  useHotkeys(
    "up",
    (e) => {
      if (!kbRef.current.active) return;
      e.preventDefault();
      moveFocus("up");
    },
    cardKeyOpts,
  );
  useHotkeys(
    "right",
    (e) => {
      if (!kbRef.current.active) return;
      e.preventDefault();
      moveFocus("right");
    },
    cardKeyOpts,
  );
  useHotkeys(
    "left",
    (e) => {
      if (!kbRef.current.active) return;
      e.preventDefault();
      moveFocus("left");
    },
    cardKeyOpts,
  );
  useHotkeys(
    "enter, e",
    (e) => {
      if (!kbRef.current.active || !kbRef.current.focusedTaskId) return;
      e.preventDefault();
      handleOpenTask(kbRef.current.focusedTaskId);
    },
    cardKeyOpts,
  );
  useHotkeys(
    "x",
    (e) => {
      if (!kbRef.current.active || !kbRef.current.focusedTaskId) return;
      e.preventDefault();
      archiveFocused();
    },
    cardKeyOpts,
  );

  return (
    <main className="flex h-[calc(100vh-57px)] flex-col">
      <StatsBar stats={stats} />
      <BoardToolbar
        archivedCount={archivedTasks.length}
        filters={filters}
        labels={labels}
        members={members}
        onChange={setFilters}
        onOpenArchive={() => setArchiveOpen(true)}
        ref={searchInputRef}
        totalCount={totalCount}
        visibleCount={visibleCount}
      />
      <DndContext
        collisionDetection={collisionDetection}
        onDragCancel={canWrite ? onDragCancel : undefined}
        onDragEnd={canWrite ? onDragEnd : undefined}
        onDragOver={canWrite ? onDragOver : undefined}
        onDragStart={canWrite ? onDragStart : undefined}
        sensors={sensors}
      >
        <div className="min-h-0 flex-1 overflow-x-auto">
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
                  focusedTaskId={focusedTaskId}
                  key={col.id}
                  labelsByTask={cardLabelsByTask}
                  membersById={membersById}
                  onAddTask={(id) => {
                    setQuickAddColumnId(id);
                    setQuickAddOpen(true);
                  }}
                  onOpenTask={handleOpenTask}
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
              <div className="text-sm font-medium">{active.column.name}</div>
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
      <ArchivePanel
        boardId={boardId}
        canWrite={canWrite}
        columnNameById={columnNameById}
        onOpenChange={setArchiveOpen}
        open={archiveOpen}
        tasks={archivedTasks}
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
      {columns.length > 0 && canWrite ? (
        <AiDraftDialog
          boardId={boardId}
          columns={columns}
          initialColumnId={aiDraftColumnId}
          labels={labels}
          onOpenChange={setAiDraftOpen}
          open={aiDraftOpen}
          projectId={projectId}
        />
      ) : null}
    </main>
  );
}
