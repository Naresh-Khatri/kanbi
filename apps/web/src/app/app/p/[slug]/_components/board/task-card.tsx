"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { MemberInfo, TaskRow } from "./board-types";
import { PRIORITY_META, type Priority, PriorityIcon } from "../priority";
import { useUndoableBoardDelete } from "../use-undoable-board-delete";

export function SortableTaskCard({
  boardId,
  task,
  columnId,
  canWrite,
  onOpen,
  assignee,
  showDropIndicatorBefore,
}: {
  boardId: string;
  task: TaskRow;
  columnId: string;
  canWrite: boolean;
  onOpen: () => void;
  assignee: MemberInfo | null;
  showDropIndicatorBefore: boolean;
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
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-2"
      exit={{ opacity: 0, scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.95 }}
      layout={sortable.isDragging ? false : "position"}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {showDropIndicatorBefore ? <DropIndicator /> : null}
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
    </motion.div>
  );
}

export function DropIndicator() {
  return (
    <div className="h-0.5 rounded-full bg-sky-400/80 shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
  );
}

export function TaskCardPreview({ task }: { task: TaskRow }) {
  return (
    <div className="w-72 rotate-2 rounded-lg border border-white/10 bg-[#14151c] p-3 shadow-xl">
      <p className="text-sm leading-snug">{task.title}</p>
    </div>
  );
}

export function TaskCard({
  boardId,
  task,
  onOpen,
  assignee,
}: {
  boardId: string;
  task: TaskRow;
  onOpen: () => void;
  assignee: MemberInfo | null;
}) {
  const remove = useUndoableBoardDelete(boardId);
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
              onSelect={() =>
                void remove({ kind: "task", id: task.id, name: task.title })
              }
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
