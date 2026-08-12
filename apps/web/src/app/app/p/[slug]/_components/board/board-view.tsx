"use client";

import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  type DropAnimation,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useAppShell } from "@/components/keybinds/shell-store";
import { invalidateProjectLifecycle } from "@/app/app/_components/invalidate-project-lifecycle";
import { OPEN_TASK_EVENT } from "@/components/ui/rich-text-mention";
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
import { DigestPanel } from "./digest-panel";
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
import { TaskCardPreview } from "./task-card";
import { TaskDetailSheet } from "../task-detail-sheet";

const DROP_ANIMATION: DropAnimation = {
  duration: 160,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: { opacity: "0" },
    },
  }),
};

export function BoardView({
  boardId,
  projectId,
  projectKey,
}: {
  boardId: string;
  projectId: string;
  projectKey: string;
  projectSlug: string;
}) {
  const [data] = api.board.get.useSuspenseQuery({ boardId });
  const membersQuery = api.project.members.useQuery({ projectId });
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
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
  // Clicking a "#KEY-123" ticket chip in any read-only render dispatches this
  // event; open that task here (chips are scoped to the current project).
  useEffect(() => {
    function onOpenTask(e: Event) {
      const id = (e as CustomEvent<{ taskId: string }>).detail?.taskId;
      if (!id) return;
      setFocusedTaskId(id);
      setOpenTaskId(id);
    }
    window.addEventListener(OPEN_TASK_EVENT, onOpenTask);
    return () => window.removeEventListener(OPEN_TASK_EVENT, onOpenTask);
  }, []);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const archiveTask = useArchiveTask(boardId);
  const createTaskToken = useAppShell((s) => s.createTaskToken);
  const lastCreateTaskToken = useRef(createTaskToken);
  useEffect(() => {
    if (createTaskToken === lastCreateTaskToken.current) return;
    lastCreateTaskToken.current = createTaskToken;
    if (columns.length > 0) {
      setQuickAddColumnId(null);
      setQuickAddOpen(true);
    }
  }, [createTaskToken, columns.length]);

  const openTask = openTaskId
    ? (tasks.find((t) => t.id === openTaskId) ?? null)
    : null;

  api.realtime.onBoardChange.useSubscription(
    { boardId },
    {
      onData: (evt) => {
        if (evt.scope === "presence") {
          // Keeps the header team/presence popover live while the board is open.
          utils.realtime.presence.invalidate({ boardId });
          return;
        }
        if (evt.scope === "board") {
          void invalidateProjectLifecycle(utils);
          return;
        }
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

  const preappliedTaskMoves = useRef(new Map<string, typeof data>());
  const preappliedColumnMoves = useRef(new Map<string, typeof data>());

  function applyOptimisticTaskMove(vars: {
    taskId: string;
    toColumnId: string;
    before: number | null;
    after: number | null;
  }) {
    utils.board.get.setData({ boardId }, (old) => {
      if (!old) return old;
      const nextPosition = positionBetween(vars.before, vars.after);
      return {
        ...old,
        tasks: old.tasks.map((t) =>
          t.id === vars.taskId
            ? {
                ...t,
                columnId: vars.toColumnId,
                position: nextPosition,
              }
            : t,
        ),
      };
    });
  }

  function applyOptimisticColumnMove(vars: {
    columnId: string;
    before: number | null;
    after: number | null;
  }) {
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
  }

  const moveTask = api.task.move.useMutation({
    onMutate: (vars) => {
      void utils.board.get.cancel({ boardId });
      const wasPreapplied = preappliedTaskMoves.current.has(vars.taskId);
      const previous = wasPreapplied
        ? preappliedTaskMoves.current.get(vars.taskId)
        : utils.board.get.getData({ boardId });
      preappliedTaskMoves.current.delete(vars.taskId);
      if (!wasPreapplied) applyOptimisticTaskMove(vars);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.board.get.setData({ boardId }, ctx.previous);
    },
    onSettled: () => utils.board.get.invalidate({ boardId }),
  });
  const reorderColumn = api.column.reorder.useMutation({
    onMutate: (vars) => {
      void utils.board.get.cancel({ boardId });
      const wasPreapplied = preappliedColumnMoves.current.has(vars.columnId);
      const previous = wasPreapplied
        ? preappliedColumnMoves.current.get(vars.columnId)
        : utils.board.get.getData({ boardId });
      preappliedColumnMoves.current.delete(vars.columnId);
      if (!wasPreapplied) applyOptimisticColumnMove(vars);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.board.get.setData({ boardId }, ctx.previous);
    },
    onSettled: () => utils.board.get.invalidate({ boardId }),
  });

  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useHotkeys(
    "/",
    (e) => {
      e.preventDefault();
      setToolbarExpanded(true);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
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

  // Mentionable tickets for the editors in the task sheet — current project only.
  // Enriched with status/priority/assignee so chips can show a summary hover card.
  const ticketItems = useMemo(() => {
    const colName = new Map(columns.map((c) => [c.id, c.name]));
    return tasks.map((t) => ({
      id: t.id,
      label: `${projectKey}-${t.number}`,
      title: t.title,
      status: colName.get(t.columnId),
      priority: t.priority,
      assignee: t.assigneeId
        ? (membersById.get(t.assigneeId)?.name ?? null)
        : null,
    }));
  }, [tasks, projectKey, columns, membersById]);

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
  const dropTargetRef = useRef<DropTarget>(null);

  const updateDropTarget = useCallback((next: DropTarget) => {
    const previous = dropTargetRef.current;
    if (
      previous?.columnId === next?.columnId &&
      previous?.beforeTaskId === next?.beforeTaskId
    ) {
      return;
    }
    dropTargetRef.current = next;
    setDropTarget(next);
  }, []);

  const columnIds = useMemo(() => new Set(columns.map((c) => c.id)), [columns]);

  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      if (args.active.data.current?.kind === "column") {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((d) =>
            columnIds.has(String(d.id)),
          ),
        });
      }

      // Pointer containment is both cheaper and less jittery than measuring the
      // distance to every card's four corners. Prefer the card under the pointer,
      // then its column drop zone. Keyboard dragging falls back to corners.
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) {
        const task = pointerCollisions.find(
          ({ data }) => data?.droppableContainer.data.current?.kind === "task",
        );
        if (task) return [task];

        const columnDropZone = pointerCollisions.find(
          ({ data }) =>
            data?.droppableContainer.data.current?.columnId !== undefined,
        );
        if (columnDropZone) return [columnDropZone];
      }

      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (d) =>
            d.data.current?.kind === "task" ||
            d.data.current?.columnId !== undefined,
        ),
      });
    },
    [columnIds],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragStart(e: DragStartEvent) {
    // Stop a realtime/refetch response from replacing the board while the user
    // is deciding where to drop.
    void utils.board.get.cancel({ boardId });
    const id = String(e.active.id);
    const kind = e.active.data.current?.kind as "task" | "column" | undefined;
    if (kind === "task") {
      const t = tasks.find((x) => x.id === id);
      if (t) {
        setActive({
          kind: "task",
          task: t,
          assignee: t.assigneeId
            ? (membersById.get(t.assigneeId) ?? null)
            : null,
          labels: cardLabelsByTask.get(t.id) ?? [],
        });
      }
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

  function getTaskDropTarget(
    e: DragOverEvent | DragMoveEvent | DragEndEvent,
  ): DropTarget {
    const { active: a, over } = e;
    if (!over) return null;
    const activeKind = a.data.current?.kind as "task" | "column" | undefined;
    if (activeKind !== "task") return null;
    const overKind = over.data.current?.kind as "task" | "column" | undefined;
    const columnId =
      (over.data.current?.columnId as string | undefined) ?? String(over.id);
    if (!columnId) return null;
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
    return { columnId, beforeTaskId };
  }

  function onDragMove(e: DragMoveEvent) {
    updateDropTarget(getTaskDropTarget(e));
  }

  function onDragOver(e: DragOverEvent) {
    updateDropTarget(getTaskDropTarget(e));
  }

  function onDragCancel() {
    setActive(null);
    updateDropTarget(null);
  }

  function onDragEnd(e: DragEndEvent) {
    const finalDropTarget = dropTargetRef.current ?? getTaskDropTarget(e);
    setActive(null);
    updateDropTarget(null);
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
      const vars = {
        boardId,
        columnId: String(a.id),
        before,
        after,
      };
      const previous = utils.board.get.getData({ boardId });
      if (previous) {
        preappliedColumnMoves.current.set(vars.columnId, previous);
      }
      applyOptimisticColumnMove(vars);
      reorderColumn.mutate(vars);
      return;
    }

    if (activeKind === "task") {
      const targetColumnId = finalDropTarget?.columnId;
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

      let insertAt = columnTasks.length;
      if (finalDropTarget.beforeTaskId !== null) {
        const requestedIndex = columnTasks.findIndex(
          (t) => t.id === finalDropTarget.beforeTaskId,
        );
        if (requestedIndex !== -1) insertAt = requestedIndex;
      }
      before = columnTasks[insertAt - 1]?.position ?? null;
      after = columnTasks[insertAt]?.position ?? null;

      if (activeTask.columnId === targetColumnId) {
        const currentOrder = tasksByColumn.get(targetColumnId) ?? [];
        const nextOrder = [...columnTasks];
        nextOrder.splice(insertAt, 0, activeTask);
        const unchanged = nextOrder.every(
          (task, index) => task.id === currentOrder[index]?.id,
        );
        if (unchanged) return;
      }

      const vars = {
        boardId,
        taskId: activeTask.id,
        toColumnId: targetColumnId,
        before,
        after,
      };
      // Apply in the drop event's React batch so DragOverlay measures the new
      // card position. onMutate reuses this snapshot for rollback.
      const previous = utils.board.get.getData({ boardId });
      if (previous) preappliedTaskMoves.current.set(vars.taskId, previous);
      applyOptimisticTaskMove(vars);
      moveTask.mutate(vars);

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

  const handleOpenTask = useCallback((taskId: string) => {
    setFocusedTaskId(taskId);
    setOpenTaskId(taskId);
  }, []);

  const handleAddTask = useCallback((columnId: string) => {
    setQuickAddColumnId(columnId);
    setQuickAddOpen(true);
  }, []);

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
  // aiDraftOpen lives in the shell store (read imperatively in nav handlers so
  // opening the AI dialog never re-renders the board); the rest are local.
  const navActive = !openTask && !quickAddOpen && !archiveOpen && !digestOpen;
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
    const {
      focusedTaskId: fid,
      canWrite: cw,
      tasks: ts,
      navColumns: cols,
    } = kbRef.current;
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
      if (useAppShell.getState().aiDraftOpen || !kbRef.current.active) return;
      e.preventDefault();
      moveFocus("down");
    },
    cardKeyOpts,
  );
  useHotkeys(
    "up",
    (e) => {
      if (useAppShell.getState().aiDraftOpen || !kbRef.current.active) return;
      e.preventDefault();
      moveFocus("up");
    },
    cardKeyOpts,
  );
  useHotkeys(
    "right",
    (e) => {
      if (useAppShell.getState().aiDraftOpen || !kbRef.current.active) return;
      e.preventDefault();
      moveFocus("right");
    },
    cardKeyOpts,
  );
  useHotkeys(
    "left",
    (e) => {
      if (useAppShell.getState().aiDraftOpen || !kbRef.current.active) return;
      e.preventDefault();
      moveFocus("left");
    },
    cardKeyOpts,
  );
  useHotkeys(
    "enter, e",
    (e) => {
      if (
        useAppShell.getState().aiDraftOpen ||
        !kbRef.current.active ||
        !kbRef.current.focusedTaskId
      )
        return;
      e.preventDefault();
      handleOpenTask(kbRef.current.focusedTaskId);
    },
    cardKeyOpts,
  );
  useHotkeys(
    "x",
    (e) => {
      if (
        useAppShell.getState().aiDraftOpen ||
        !kbRef.current.active ||
        !kbRef.current.focusedTaskId
      )
        return;
      e.preventDefault();
      archiveFocused();
    },
    cardKeyOpts,
  );

  return (
    <main className="flex h-[calc(100vh-57px)] flex-col">
      <BoardToolbar
        archivedCount={archivedTasks.length}
        expanded={toolbarExpanded}
        filters={filters}
        labels={labels}
        members={members}
        onChange={setFilters}
        onExpandedChange={setToolbarExpanded}
        onOpenArchive={() => setArchiveOpen(true)}
        onOpenDigest={() => setDigestOpen(true)}
        ref={searchInputRef}
        totalCount={totalCount}
        visibleCount={visibleCount}
      />
      <DndContext
        collisionDetection={collisionDetection}
        onDragCancel={canWrite ? onDragCancel : undefined}
        onDragEnd={canWrite ? onDragEnd : undefined}
        onDragMove={canWrite ? onDragMove : undefined}
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
                  onAddTask={handleAddTask}
                  onOpenTask={handleOpenTask}
                  projectKey={projectKey}
                  tasks={tasksByColumn.get(col.id) ?? []}
                />
              ))}
            </SortableContext>
            {canWrite ? <AddColumn boardId={boardId} /> : null}
          </div>
        </div>
        <DragOverlay
          dropAnimation={DROP_ANIMATION}
          style={{ willChange: "transform" }}
        >
          {active?.kind === "task" ? (
            <TaskCardPreview
              assignee={active.assignee}
              labels={active.labels}
              projectKey={projectKey}
              task={active.task}
            />
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
        columns={columns}
        labels={labels}
        onOpenChange={(o) => {
          if (!o) setOpenTaskId(null);
        }}
        open={!!openTask}
        projectId={projectId}
        projectKey={projectKey}
        task={openTask}
        taskLabels={taskLabels}
        tasks={tasks}
        tickets={ticketItems}
      />
      <ArchivePanel
        boardId={boardId}
        canWrite={canWrite}
        columnNameById={columnNameById}
        onOpenChange={setArchiveOpen}
        open={archiveOpen}
        tasks={archivedTasks}
      />
      <DigestPanel
        boardId={boardId}
        canWrite={canWrite}
        members={members}
        onOpenChange={setDigestOpen}
        onOpenTask={handleOpenTask}
        open={digestOpen}
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
