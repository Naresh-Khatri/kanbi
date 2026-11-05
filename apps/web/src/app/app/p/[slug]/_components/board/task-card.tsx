"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  GitBranch,
  Link2,
  MoreHorizontal,
  Sun,
  Timer,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import type { LabelInfo, MemberInfo, TaskRow } from "./board-types";
import { copyBranchCommand, defaultBranchType } from "../copy-branch-command";
import { copyTaskLink } from "../copy-task-link";
import { type Priority, PriorityBadge } from "../priority";
import { useArchiveTask } from "../use-archive-task";
import { useUndoableBoardDelete } from "../use-undoable-board-delete";

const SORTABLE_TRANSITION = {
  duration: 150,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
};

export const SortableTaskCard = memo(function SortableTaskCard({
  boardId,
  task,
  columnId,
  canWrite,
  onOpenTask,
  assignee,
  labels,
  showDropIndicatorBefore,
  focused,
  projectKey,
  selected,
  onToggleSelection,
}: {
  boardId: string;
  task: TaskRow;
  columnId: string;
  canWrite: boolean;
  onOpenTask: (taskId: string) => void;
  assignee: MemberInfo | null;
  labels: LabelInfo[];
  showDropIndicatorBefore: boolean;
  focused: boolean;
  projectKey: string;
  selected: boolean;
  onToggleSelection?: (taskId: string, extend: boolean) => void;
}) {
  const sortable = useSortable({
    id: task.id,
    data: { kind: "task", columnId },
    disabled: !canWrite,
    transition: SORTABLE_TRANSITION,
  });

  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0 : 1,
    willChange: sortable.transform ? "transform" : undefined,
  };

  const onOpen = useCallback(() => onOpenTask(task.id), [onOpenTask, task.id]);

  return (
    <div className="relative flex flex-col gap-2">
      {showDropIndicatorBefore ? (
        <DropIndicator className="inset-x-0 -top-1" />
      ) : null}
      <div
        className="touch-none select-none"
        ref={sortable.setNodeRef}
        style={style}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <TaskCard
          assignee={assignee}
          boardId={boardId}
          canWrite={canWrite}
          focused={focused}
          labels={labels}
          onOpen={onOpen}
          onToggleSelection={
            onToggleSelection
              ? (extend) => onToggleSelection(task.id, extend)
              : undefined
          }
          projectKey={projectKey}
          selected={selected}
          task={task}
        />
      </div>
    </div>
  );
});

export function DropIndicator({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "bg-info/70 pointer-events-none absolute z-10 h-0.5 rounded-full",
        className,
      )}
    />
  );
}

export function TaskCardPreview({
  task,
  assignee,
  labels,
  projectKey,
}: {
  task: TaskRow;
  assignee: MemberInfo | null;
  labels: LabelInfo[];
  projectKey: string;
}) {
  return (
    <div className="bg-raised w-72 rounded-lg border border-white/20 p-3 will-change-transform">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug">{task.title}</p>
        <div className="h-9 w-9 shrink-0" />
      </div>
      <CardBody
        assignee={assignee}
        labels={labels}
        projectKey={projectKey}
        task={task}
      />
    </div>
  );
}

const MAX_VISIBLE_LABELS = 2;

function CardBody({
  task,
  assignee,
  labels,
  projectKey,
}: {
  task: TaskRow;
  assignee: MemberInfo | null;
  labels: LabelInfo[];
  projectKey: string;
}) {
  const visibleLabels = labels.slice(0, MAX_VISIBLE_LABELS);
  const overflowCount = labels.length - visibleLabels.length;
  const priority = task.priority as Priority;

  return (
    <>
      {labels.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {visibleLabels.map((l) => (
            <Badge color={l.color} key={l.id}>
              {l.name}
            </Badge>
          ))}
          {overflowCount > 0 ? <Badge>+{overflowCount}</Badge> : null}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-2xs font-mono tracking-wide text-white/40">
            {projectKey}-{task.number}
          </span>
          {priority !== "none" ? <PriorityBadge priority={priority} /> : null}
          {task.estimatePomodoros != null ? (
            <span className="inline-flex items-center gap-1 text-xs text-white/40">
              <Timer className="h-3 w-3" />
              {task.estimatePomodoros}
            </span>
          ) : null}
        </div>
        {assignee ? (
          <UserAvatar image={assignee.image} name={assignee.name} size={20} />
        ) : null}
      </div>
    </>
  );
}

export const TaskCard = memo(function TaskCard({
  boardId,
  task,
  onOpen,
  assignee,
  labels,
  focused = false,
  projectKey,
  selected = false,
  onToggleSelection,
  canWrite,
}: {
  boardId: string;
  task: TaskRow;
  onOpen: () => void;
  assignee: MemberInfo | null;
  labels: LabelInfo[];
  focused?: boolean;
  projectKey: string;
  selected?: boolean;
  onToggleSelection?: (extend: boolean) => void;
  canWrite: boolean;
}) {
  const remove = useUndoableBoardDelete(boardId);
  const archiveTask = useArchiveTask(boardId);
  const toggleToday = useToggleToday(task.id);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  return (
    <div
      className={cn(
        "group bg-raised w-full cursor-pointer rounded-lg border border-white/10 p-3 transition hover:border-white/20",
        focused && "border-info/70 ring-info/40 ring-2",
        selected && "border-info/70 bg-info/10",
      )}
      onClick={(event) => {
        if (event.shiftKey && onToggleSelection) {
          event.preventDefault();
          onToggleSelection(true);
          return;
        }
        onOpen();
      }}
      ref={ref}
    >
      <div className="flex items-start justify-between gap-2">
        {onToggleSelection ? (
          <Checkbox
            aria-label={selected ? "Deselect task" : "Select task"}
            checked={selected}
            className={cn(
              "mt-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              selected && "opacity-100",
            )}
            onCheckedChange={() => {}}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault(); // skip onCheckedChange; shiftKey needed
              onToggleSelection(event.shiftKey);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            tone="info"
          />
        ) : null}
        <p className="min-w-0 flex-1 text-sm leading-snug">{task.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`More actions for ${task.title}`}
              className="opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              size="icon"
              title={`More actions for ${task.title}`}
              variant="ghost"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => copyTaskLink(task.id)}>
              <Link2 className="h-3.5 w-3.5" /> Copy link
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                copyBranchCommand({
                  number: task.number,
                  title: task.title,
                  type: defaultBranchType(labels.map((l) => l.name)),
                })
              }
            >
              <GitBranch className="h-3.5 w-3.5" /> Copy git branch
            </DropdownMenuItem>
            {canWrite ? (
              <>
                <DropdownMenuItem onSelect={toggleToday.onSelect}>
                  <Sun className="h-3.5 w-3.5" />
                  {toggleToday.onToday ? "Remove from Today" : "Add to Today"}
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
                    void remove({
                      kind: "task",
                      id: task.id,
                      name: task.title,
                    })
                  }
                >
                  Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CardBody
        assignee={assignee}
        labels={labels}
        projectKey={projectKey}
        task={task}
      />
    </div>
  );
});

// today.ids is a single small array shared across every card's cache entry —
// cheap to subscribe to per-card, only one request per board view.
function useToggleToday(taskId: string) {
  const utils = api.useUtils();
  const ids = api.today.ids.useQuery();
  const onToday = ids.data?.includes(taskId) ?? false;

  const invalidate = () => {
    void utils.today.ids.invalidate();
    void utils.today.list.invalidate();
  };

  const add = api.today.add.useMutation({
    onMutate: async () => {
      await utils.today.ids.cancel();
      const previous = utils.today.ids.getData();
      utils.today.ids.setData(undefined, (old) => [...(old ?? []), taskId]);
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) utils.today.ids.setData(undefined, ctx.previous);
      toast.error(e.message);
    },
    onSettled: invalidate,
  });
  const remove = api.today.remove.useMutation({
    onMutate: async () => {
      await utils.today.ids.cancel();
      const previous = utils.today.ids.getData();
      utils.today.ids.setData(undefined, (old) =>
        old?.filter((id) => id !== taskId),
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) utils.today.ids.setData(undefined, ctx.previous);
      toast.error(e.message);
    },
    onSettled: invalidate,
  });

  return {
    onToday,
    onSelect: () =>
      onToday ? remove.mutate({ taskId }) : add.mutate({ taskId }),
  };
}
