"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, Plus } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/surface";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  ColumnRow,
  DropTarget,
  LabelInfo,
  MemberInfo,
  TaskRow,
} from "./board-types";
import { ColumnHeader } from "./column-header";
import { DropIndicator, SortableTaskCard } from "./task-card";
import type { ColumnSortDir, ColumnSortMode } from "@/lib/task-sort";
import { cn } from "@/lib/utils";

const EMPTY_LABELS: LabelInfo[] = [];
const SORTABLE_TRANSITION = {
  duration: 150,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
};

export const SortableColumn = memo(function SortableColumn({
  boardId,
  column,
  tasks,
  canWrite,
  dropTarget,
  onOpenTask,
  onAddTask,
  membersById,
  labelsByTask,
  focusedTaskId,
  projectKey,
  sortBlocked,
  totalTaskCount,
  columns,
  deletionTaskCount,
  collapsed,
  onCollapseChange,
  onHide,
  sortMode,
  sortDir,
  onSortChange,
  onMoveLeft,
  onMoveRight,
  isDefaultColumn,
  onDefaultColumnChange,
  selectedTaskIds,
  onToggleTaskSelection,
}: {
  boardId: string;
  column: ColumnRow;
  tasks: TaskRow[];
  canWrite: boolean;
  dropTarget: DropTarget;
  onOpenTask: (taskId: string) => void;
  onAddTask: (columnId: string) => void;
  membersById: Map<string, MemberInfo>;
  labelsByTask: Map<string, LabelInfo[]>;
  focusedTaskId: string | null;
  projectKey: string;
  sortBlocked: boolean;
  totalTaskCount: number;
  columns: ColumnRow[];
  deletionTaskCount: number;
  collapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
  onHide: () => void;
  sortMode: ColumnSortMode;
  sortDir: ColumnSortDir;
  onSortChange: (mode: ColumnSortMode, dir: ColumnSortDir) => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  isDefaultColumn: boolean;
  onDefaultColumnChange: (isDefault: boolean) => void;
  selectedTaskIds: Set<string>;
  onToggleTaskSelection: (taskId: string, extend: boolean) => void;
}) {
  const sortable = useSortable({
    id: column.id,
    data: { kind: "column" },
    disabled: !canWrite,
    transition: SORTABLE_TRANSITION,
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `col-drop-${column.id}`,
    data: { kind: "column", columnId: column.id },
  });

  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
    willChange: sortable.transform ? "transform" : undefined,
  };

  if (collapsed) {
    return (
      <div
        className={cn(
          "flex h-full w-12 shrink-0 snap-center flex-col items-center rounded-lg bg-white/5 py-2 md:[scroll-snap-align:none]",
          dropTarget && "bg-white/10 ring-1 ring-white/20",
        )}
        ref={sortable.setNodeRef}
        style={style}
      >
        <Button
          aria-label={`Expand ${column.name}`}
          onClick={() => onCollapseChange(false)}
          size="icon"
          variant="ghost"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <button
          className="mt-2 flex min-h-0 flex-1 cursor-grab touch-none items-center gap-2 text-sm font-medium text-white/70 [writing-mode:vertical-rl] active:cursor-grabbing"
          onClick={() => onCollapseChange(false)}
          ref={setDropRef}
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <span className="rotate-180 truncate">{column.name}</span>
          <span
            className={cn(
              "rotate-180 text-xs text-white/40",
              column.wipLimit != null &&
                totalTaskCount > column.wipLimit &&
                "text-warning",
            )}
          >
            {column.wipLimit != null
              ? `${totalTaskCount}/${column.wipLimit}`
              : totalTaskCount}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-[calc(100vw-2rem)] shrink-0 snap-center flex-col gap-3 rounded-lg bg-white/5 p-3 md:w-72 md:[scroll-snap-align:none]",
        column.wipLimit != null &&
          totalTaskCount > column.wipLimit &&
          "ring-warning/40 ring-1",
      )}
      ref={sortable.setNodeRef}
      style={style}
    >
      <ColumnHeader
        boardId={boardId}
        canWrite={canWrite}
        column={column}
        columns={columns}
        deletionTaskCount={deletionTaskCount}
        dragHandleProps={{
          ...sortable.attributes,
          ...sortable.listeners,
        }}
        onAddTask={onAddTask}
        onCollapse={() => onCollapseChange(true)}
        onHide={onHide}
        onMoveLeft={onMoveLeft}
        onMoveRight={onMoveRight}
        isDefaultColumn={isDefaultColumn}
        onDefaultColumnChange={onDefaultColumnChange}
        onSortChange={onSortChange}
        sortBlocked={sortBlocked}
        sortDir={sortDir}
        sortMode={sortMode}
        taskCount={tasks.length}
        totalTaskCount={totalTaskCount}
      />
      <ScrollArea className="-mx-1 min-h-0 flex-1">
        <div
          className="relative flex min-h-16 flex-col gap-2 px-1 pb-1"
          ref={setDropRef}
        >
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map((t) => (
              <SortableTaskCard
                assignee={
                  t.assigneeId ? (membersById.get(t.assigneeId) ?? null) : null
                }
                boardId={boardId}
                canWrite={canWrite}
                columnId={column.id}
                focused={focusedTaskId === t.id}
                key={t.id}
                labels={labelsByTask.get(t.id) ?? EMPTY_LABELS}
                onOpenTask={onOpenTask}
                projectKey={projectKey}
                selected={selectedTaskIds.has(t.id)}
                showDropIndicatorBefore={
                  !sortBlocked && dropTarget?.beforeTaskId === t.id
                }
                task={t}
                onToggleSelection={canWrite ? onToggleTaskSelection : undefined}
              />
            ))}
          </SortableContext>
          {tasks.length === 0 && !dropTarget ? (
            <EmptyState size="sm">
              <p>{totalTaskCount > 0 ? "No matching tasks" : "No tasks yet"}</p>
              {canWrite && totalTaskCount === 0 ? (
                <Button
                  onClick={() => onAddTask(column.id)}
                  size="sm"
                  variant="property"
                >
                  <Plus className="h-3.5 w-3.5" /> Add task
                </Button>
              ) : null}
            </EmptyState>
          ) : null}
          {!sortBlocked &&
          dropTarget &&
          dropTarget.beforeTaskId === null &&
          tasks.length > 0 ? (
            <DropIndicator className="inset-x-1 -bottom-px" />
          ) : null}
          {tasks.length === 0 && dropTarget ? (
            <div className="pointer-events-none absolute inset-0 rounded-md border border-dashed border-white/20 bg-white/5" />
          ) : null}
        </div>
      </ScrollArea>
      {canWrite && tasks.length > 0 ? (
        <Button
          className="justify-start"
          onClick={() => onAddTask(column.id)}
          size="sm"
          variant="property"
        >
          <Plus className="h-4 w-4" /> Add task
        </Button>
      ) : null}
    </div>
  );
});
