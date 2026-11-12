import { formatDate } from "@kanbi/shared";
import type { CSSProperties } from "react";
import {
  CalendarClockIcon,
  ChevronRightIcon,
  ImageIcon,
  SquareCheckIcon,
} from "lucide-react";

import {
  type Priority,
  PriorityInline,
} from "@/app/app/p/[slug]/_components/priority";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { TaskView } from "./public-types";

const MAX_LABELS = 3;

export function PublicTaskCard({
  view,
  onOpen,
  compact = false,
  index = 0,
}: {
  view: TaskView;
  onOpen: () => void;
  compact?: boolean;
  /** position in its column -> entrance stagger */
  index?: number;
}) {
  const { task, labels, assignee, checklist, images, done, overdue } = view;
  const checked = checklist.filter((c) => c.done).length;

  return (
    <button
      className={cn(
        "group bg-card relative w-full cursor-pointer touch-manipulation rounded-lg border text-left shadow-xs/5 outline-none",
        "transition-[scale,box-shadow,border-color,opacity] duration-150 ease-out",
        "hover:border-input hover:shadow-md/8 active:scale-[0.98] active:shadow-xs/5 motion-reduce:active:scale-100",
        "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-1",
        "fill-mode-both animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none",
        // column-colour accent bar = hover cue that also says which status it's in
        "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-(--accent) before:opacity-0 before:transition-opacity hover:before:opacity-100 focus-visible:before:opacity-100",
        compact
          ? "flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 sm:flex-nowrap sm:py-2"
          : "p-3",
        done && "opacity-64 hover:opacity-100",
      )}
      onClick={onOpen}
      style={
        {
          "--accent": view.column.color ?? "var(--color-ring)",
          // cap so long columns don't trickle in
          animationDelay: `${Math.min(index, 8) * 30}ms`,
        } as CSSProperties
      }
      type="button"
    >
      {compact ? (
        <span className="text-muted-foreground w-16 shrink-0 font-mono text-xs tracking-wide">
          {view.key}
        </span>
      ) : null}
      <p
        className={cn(
          "text-foreground text-sm leading-snug",
          compact ? "min-w-0 flex-1 truncate" : "line-clamp-3",
        )}
      >
        {task.title}
      </p>
      <div
        className={cn(
          "text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs",
          // ps-19 = key width + gap -> meta lines up under the title
          compact ? "max-sm:w-full max-sm:ps-19 sm:shrink-0" : "mt-2.5",
        )}
      >
        {!compact ? (
          <span className="font-mono tracking-wide">{view.key}</span>
        ) : null}
        {task.priority !== "none" ? (
          <PriorityInline priority={task.priority as Priority} />
        ) : null}
        {!compact
          ? labels.slice(0, MAX_LABELS).map((l) => (
              <span
                className="inline-flex min-w-0 items-center gap-1"
                key={l.id}
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: l.color }}
                />
                <span className="max-w-24 truncate">{l.name}</span>
              </span>
            ))
          : null}
        {!compact && labels.length > MAX_LABELS ? (
          <span>+{labels.length - MAX_LABELS}</span>
        ) : null}
        {task.dueAt ? (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              overdue && "text-destructive-foreground",
            )}
          >
            <CalendarClockIcon aria-hidden="true" className="size-3" />
            {formatDate(task.dueAt)}
          </span>
        ) : null}
        {checklist.length > 0 ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 tabular-nums",
              checked === checklist.length && "text-success-foreground",
            )}
          >
            <SquareCheckIcon aria-hidden="true" className="size-3" />
            {checked}/{checklist.length}
          </span>
        ) : null}
        {images.length > 0 ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <ImageIcon aria-hidden="true" className="size-3" />
            {images.length}
            <span className="sr-only">
              {images.length === 1 ? "image" : "images"}
            </span>
          </span>
        ) : null}
        {assignee ? (
          <span className={cn("inline-flex", !compact && "ms-auto")}>
            <UserAvatar image={assignee.image} name={assignee.name} size={18} />
          </span>
        ) : null}
        {compact ? (
          <ChevronRightIcon
            aria-hidden="true"
            className="text-muted-foreground/48 group-hover:text-foreground size-4 transition-colors max-sm:hidden"
          />
        ) : null}
      </div>
    </button>
  );
}
