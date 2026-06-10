"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
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

const EMPTY_LABELS: LabelInfo[] = [];

export function SortableColumn({
  boardId,
  column,
  tasks,
  canWrite,
  dropTarget,
  onOpenTask,
  onAddTask,
  membersById,
  labelsByTask,
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
      className="flex h-full w-72 shrink-0 flex-col gap-3 rounded-xl bg-white/[0.03] p-3"
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
      <ScrollArea className="-mx-1 min-h-0 flex-1">
        <div className="flex flex-col gap-2 px-1 pb-1" ref={setDropRef}>
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <AnimatePresence initial={false}>
              {tasks.map((t) => (
                <SortableTaskCard
                  assignee={
                    t.assigneeId
                      ? (membersById.get(t.assigneeId) ?? null)
                      : null
                  }
                  boardId={boardId}
                  canWrite={canWrite}
                  columnId={column.id}
                  key={t.id}
                  labels={labelsByTask.get(t.id) ?? EMPTY_LABELS}
                  onOpen={() => onOpenTask(t.id)}
                  showDropIndicatorBefore={dropTarget?.beforeTaskId === t.id}
                  task={t}
                />
              ))}
            </AnimatePresence>
          </SortableContext>
          {dropTarget &&
          dropTarget.beforeTaskId === null &&
          tasks.length > 0 ? (
            <DropIndicator />
          ) : null}
          {tasks.length === 0 && dropTarget ? (
            <div className="h-16 rounded-md border border-dashed border-white/40 bg-white/[0.04]" />
          ) : null}
        </div>
      </ScrollArea>
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
