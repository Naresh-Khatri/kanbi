"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Link2, MoreHorizontal } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import type { LabelInfo, MemberInfo, TaskRow } from "./board-types";
import { copyTaskLink } from "../copy-task-link";
import { PRIORITY_META, type Priority, PriorityIcon } from "../priority";
import { useArchiveTask } from "../use-archive-task";
import { useUndoableBoardDelete } from "../use-undoable-board-delete";

export function SortableTaskCard({
  boardId,
  task,
  columnId,
  canWrite,
  onOpen,
  assignee,
  labels,
  showDropIndicatorBefore,
  focused,
  projectKey,
}: {
  boardId: string;
  task: TaskRow;
  columnId: string;
  canWrite: boolean;
  onOpen: () => void;
  assignee: MemberInfo | null;
  labels: LabelInfo[];
  showDropIndicatorBefore: boolean;
  focused: boolean;
  projectKey: string;
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
          focused={focused}
          labels={labels}
          onOpen={onOpen}
          projectKey={projectKey}
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

const MAX_VISIBLE_LABELS = 2;

export function TaskCard({
  boardId,
  task,
  onOpen,
  assignee,
  labels,
  focused = false,
  projectKey,
}: {
  boardId: string;
  task: TaskRow;
  onOpen: () => void;
  assignee: MemberInfo | null;
  labels: LabelInfo[];
  focused?: boolean;
  projectKey: string;
}) {
  const remove = useUndoableBoardDelete(boardId);
  const archiveTask = useArchiveTask(boardId);
  const ref = useRef<HTMLDivElement>(null);
  const visibleLabels = labels.slice(0, MAX_VISIBLE_LABELS);
  const overflowCount = labels.length - visibleLabels.length;

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  return (
    <div
      className={cn(
        "group w-full cursor-pointer rounded-lg border border-white/10 bg-[#14151c] p-3 transition hover:border-white/20",
        focused && "border-sky-400/60 ring-2 ring-sky-400/50",
      )}
      onClick={onOpen}
      ref={ref}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug">{task.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem onSelect={() => copyTaskLink(task.id)}>
              <Link2 className="h-3.5 w-3.5" /> Copy link
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                archiveTask({ id: task.id, title: task.title })
              }
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
      {labels.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {visibleLabels.map((l) => (
            <span
              className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] tracking-wide"
              key={l.id}
              style={{ borderColor: `${l.color}55`, color: l.color }}
            >
              {l.name}
            </span>
          ))}
          {overflowCount > 0 ? (
            <span className="inline-flex items-center rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] tracking-wide text-white/60">
              +{overflowCount}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[10px] tracking-wide text-white/40">
            {projectKey}-{task.number}
          </span>
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
          ) : null}
        </div>
        {assignee ? (
          <UserAvatar image={assignee.image} name={assignee.name} size={20} />
        ) : null}
      </div>
    </div>
  );
}
