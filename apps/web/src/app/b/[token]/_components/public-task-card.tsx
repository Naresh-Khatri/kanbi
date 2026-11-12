import { formatDate } from "@kanbi/shared";
import { CalendarClock, CheckSquare } from "lucide-react";

import {
  type Priority,
  PriorityInline,
} from "@/app/app/p/[slug]/_components/priority";
import { Dot } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import type { TaskView } from "./public-types";

const MAX_LABELS = 3;

export function PublicTaskCard({
  view,
  onOpen,
  compact = false,
}: {
  view: TaskView;
  onOpen: () => void;
  compact?: boolean;
}) {
  const { task, labels, assignee, checklist, done, overdue } = view;
  const checked = checklist.filter((c) => c.done).length;

  return (
    <button
      className={cn(
        "group bg-raised focus-visible:border-info/60 w-full rounded-lg border border-white/10 text-left transition-colors hover:border-white/20 focus-visible:outline-none",
        compact ? "flex items-center gap-3 px-3 py-2" : "p-3",
        done && "opacity-60 hover:opacity-100",
      )}
      onClick={onOpen}
      type="button"
    >
      {compact ? (
        <span className="text-2xs w-16 shrink-0 font-mono tracking-wide text-white/40">
          {view.key}
        </span>
      ) : null}
      <p
        className={cn(
          "text-sm leading-snug text-white",
          compact ? "min-w-0 flex-1 truncate" : "line-clamp-3",
        )}
      >
        {task.title}
      </p>
      <div
        className={cn(
          "text-2xs flex flex-wrap items-center gap-x-2.5 gap-y-1",
          compact ? "shrink-0" : "mt-2.5",
        )}
      >
        {!compact ? (
          <span className="font-mono tracking-wide text-white/40">
            {view.key}
          </span>
        ) : null}
        {task.priority !== "none" ? (
          <PriorityInline priority={task.priority as Priority} />
        ) : null}
        {!compact
          ? labels.slice(0, MAX_LABELS).map((l) => (
              <span
                className="inline-flex min-w-0 items-center gap-1 text-white/70"
                key={l.id}
              >
                <Dot color={l.color} size="xs" />
                <span className="max-w-24 truncate">{l.name}</span>
              </span>
            ))
          : null}
        {!compact && labels.length > MAX_LABELS ? (
          <span className="text-white/40">+{labels.length - MAX_LABELS}</span>
        ) : null}
        {task.dueAt ? (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              overdue ? "text-danger" : "text-white/50",
            )}
          >
            <CalendarClock aria-hidden className="h-3 w-3" />
            {formatDate(task.dueAt)}
          </span>
        ) : null}
        {checklist.length > 0 ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 tabular-nums",
              checked === checklist.length ? "text-success" : "text-white/50",
            )}
          >
            <CheckSquare aria-hidden className="h-3 w-3" />
            {checked}/{checklist.length}
          </span>
        ) : null}
        {assignee ? (
          <span className={cn("inline-flex", !compact && "ml-auto")}>
            <UserAvatar image={assignee.image} name={assignee.name} size={18} />
          </span>
        ) : null}
      </div>
    </button>
  );
}
