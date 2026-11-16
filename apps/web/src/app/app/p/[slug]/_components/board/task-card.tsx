"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArchiveIcon,
  GitBranchIcon,
  Link2Icon,
  MoreHorizontalIcon,
  SunIcon,
  TimerIcon,
  Trash2Icon,
} from "lucide-react";
import { formatRelative } from "@kanbi/shared";
import { motion } from "motion/react";
import { memo, useCallback, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuPopup,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Menu, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { toastManager } from "@/components/ui/toast";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { copyBranchCommand, defaultBranchType } from "../copy-branch-command";
import { copyTaskLink } from "../copy-task-link";
import { type Priority, PriorityInline } from "../priority";
import { useArchiveTask } from "../use-archive-task";
import { useUndoableBoardDelete } from "../use-undoable-board-delete";
import type { LabelInfo, MemberInfo, TaskRow } from "./board-types";
import { type TaskUpdate, updateLabel } from "./use-board-updates";
import { CONTEXT_MENU_PARTS, MENU_PARTS, type MenuParts } from "./menu-parts";

const REVEAL =
  "opacity-0 in-[[data-slot=task-card]:hover]:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100";

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
  completed,
  update,
}: {
  boardId: string;
  task: TaskRow;
  columnId: string;
  completed?: boolean;
  update?: TaskUpdate;
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
        className="touch-manipulation select-none"
        data-slot="task-card-sortable"
        ref={sortable.setNodeRef}
        style={style}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <TaskCard
          assignee={assignee}
          boardId={boardId}
          canWrite={canWrite}
          completed={completed}
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
          update={update}
        />
      </div>
    </div>
  );
});

export function DropIndicator({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-info pointer-events-none absolute z-10 h-0.5 rounded-full",
        className,
      )}
    />
  );
}

/** drag overlay: lifts + tilts on pickup; overlay unmount = drop anim (dnd-kit) */
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
    <motion.div
      animate={{ rotate: -1.5, scale: 1.02 }}
      className="bg-popover w-72 cursor-grabbing rounded-lg border p-2.5 shadow-lg/10 will-change-transform"
      initial={{ rotate: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
    >
      <p className="line-clamp-2 text-sm leading-snug">{task.title}</p>
      <CardBody
        assignee={assignee}
        labels={labels}
        projectKey={projectKey}
        task={task}
      />
    </motion.div>
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
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="text-muted-foreground font-mono tracking-wide">
        {projectKey}-{task.number}
      </span>
      {priority !== "none" ? <PriorityInline priority={priority} /> : null}
      {visibleLabels.map((l) => (
        <Badge className="min-w-0" key={l.id} size="sm" variant="outline">
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: l.color }}
          />
          <span className="max-w-24 truncate">{l.name}</span>
        </Badge>
      ))}
      {overflowCount > 0 ? (
        <span className="text-muted-foreground">+{overflowCount}</span>
      ) : null}
      {task.estimatePomodoros != null ? (
        <span className="text-muted-foreground inline-flex items-center gap-1">
          <TimerIcon aria-hidden="true" className="size-3" />
          {task.estimatePomodoros}
        </span>
      ) : null}
      {assignee ? (
        <UserAvatar
          className="ms-auto"
          image={assignee.image}
          name={assignee.name}
          size={20}
        />
      ) : null}
    </div>
  );
}

type TaskActions = {
  canWrite: boolean;
  onToday: boolean;
  onCopyLink: () => void;
  onCopyBranch: () => void;
  onToggleToday: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

function TaskActionItems({
  parts: P,
  actions: a,
}: {
  parts: MenuParts;
  actions: TaskActions;
}) {
  return (
    <>
      <P.Item onClick={a.onCopyLink}>
        <Link2Icon aria-hidden="true" /> Copy link
      </P.Item>
      <P.Item onClick={a.onCopyBranch}>
        <GitBranchIcon aria-hidden="true" /> Copy git branch
      </P.Item>
      {a.canWrite ? (
        <>
          <P.Item onClick={a.onToggleToday}>
            <SunIcon aria-hidden="true" />
            {a.onToday ? "Remove from Today" : "Add to Today"}
          </P.Item>
          <P.Item onClick={a.onArchive}>
            <ArchiveIcon aria-hidden="true" /> Archive
          </P.Item>
          <P.Separator />
          <P.Item onClick={a.onDelete} variant="destructive">
            <Trash2Icon aria-hidden="true" /> Delete
          </P.Item>
        </>
      ) : null}
    </>
  );
}

// popups portal, but react events still bubble to the card -> don't open/drag it
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

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
  completed = false,
  update,
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
  completed?: boolean;
  /** unseen activity; done cards stay bright until the reporter looks */
  update?: TaskUpdate;
}) {
  const remove = useUndoableBoardDelete(boardId);
  const archiveTask = useArchiveTask(boardId);
  const toggleToday = useToggleToday(task.id);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  const actions: TaskActions = {
    canWrite,
    onToday: toggleToday.onToday,
    onCopyLink: () => copyTaskLink(task.id),
    onCopyBranch: () =>
      copyBranchCommand({
        number: task.number,
        title: task.title,
        type: defaultBranchType(labels.map((l) => l.name)),
      }),
    onToggleToday: toggleToday.onSelect,
    onArchive: () => archiveTask({ id: task.id, title: task.title }),
    onDelete: () =>
      void remove({ kind: "task", id: task.id, name: task.title }),
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className={cn(
          "bg-card hover:border-input relative w-full cursor-pointer rounded-lg border p-2.5 shadow-xs/5 transition-colors",
          focused && "border-ring ring-ring/40 ring-2",
          selected && "border-info/64 bg-info/8 dark:bg-info/16",
          update && !selected && "border-info/40",
        )}
        data-slot="task-card"
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
        {onToggleSelection ? (
          <Checkbox
            aria-label={selected ? "Deselect task" : "Select task"}
            checked={selected}
            className={cn(
              "bg-popover absolute -start-1.5 -top-1.5 z-10 shadow-sm/5",
              REVEAL,
              selected && "opacity-100",
            )}
            onCheckedChange={() => {}}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault(); // skip onCheckedChange; shiftKey needed
              onToggleSelection(event.shiftKey);
            }}
            onPointerDown={stop}
          />
        ) : null}
        <p
          className={cn(
            "line-clamp-2 pe-5 text-sm leading-snug",
            completed && !update && "text-muted-foreground",
          )}
        >
          {task.title}
        </p>
        {update ? (
          <p
            className={cn(
              "mt-1 flex items-center gap-1.5 text-xs font-medium",
              update.reason === "blocked"
                ? "text-warning-foreground"
                : "text-info-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                update.reason === "blocked" ? "bg-warning" : "bg-info",
              )}
            />
            <span className="truncate">{updateLabel(update)}</span>
            <span className="text-muted-foreground shrink-0 font-normal">
              · {formatRelative(update.at)}
            </span>
          </p>
        ) : null}
        <Menu>
          <MenuTrigger
            render={
              <Button
                aria-label={`More actions for ${task.title}`}
                className={cn(
                  "bg-card text-muted-foreground absolute end-1.5 top-1.5",
                  REVEAL,
                )}
                onClick={stop}
                onPointerDown={stop}
                size="icon-xs"
                variant="ghost"
              />
            }
          >
            <MoreHorizontalIcon aria-hidden="true" />
          </MenuTrigger>
          <MenuPopup align="end" className="w-48" onClick={stop}>
            <TaskActionItems actions={actions} parts={MENU_PARTS} />
          </MenuPopup>
        </Menu>
        <CardBody
          assignee={assignee}
          labels={labels}
          projectKey={projectKey}
          task={task}
        />
      </ContextMenuTrigger>
      <ContextMenuPopup className="w-48" onClick={stop}>
        <TaskActionItems actions={actions} parts={CONTEXT_MENU_PARTS} />
      </ContextMenuPopup>
    </ContextMenu>
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
      toastManager.add({ type: "error", title: e.message });
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
      toastManager.add({ type: "error", title: e.message });
    },
    onSettled: invalidate,
  });

  return {
    onToday,
    onSelect: () =>
      onToday ? remove.mutate({ taskId }) : add.mutate({ taskId }),
  };
}
