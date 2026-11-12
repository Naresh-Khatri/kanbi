"use client";

import { formatDate, formatRelative } from "@kanbi/shared";
import { Check, Link2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  type Priority,
  PriorityInline,
} from "@/app/app/p/[slug]/_components/priority";
import { Badge, Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RichTextContent } from "@/components/ui/rich-text-editor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import type { TaskView } from "./public-types";

export function PublicTaskSheet({
  view,
  onClose,
}: {
  view: TaskView | null;
  onClose: () => void;
}) {
  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open={view != null}>
      <SheetContent className="overflow-y-auto">
        {view ? <SheetBody view={view} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ view }: { view: TaskView }) {
  const { task, column, labels, assignee, checklist, overdue } = view;
  const checked = checklist.filter((c) => c.done).length;

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span className="font-mono tracking-wide">{view.key}</span>
          <Button
            aria-label="Copy link to this task"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              toast.success("Task link copied");
            }}
            size="icon-xs"
            type="button"
            variant="quiet"
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <SheetTitle className="text-xl leading-snug">{task.title}</SheetTitle>
        <SheetDescription className="text-xs text-white/40">
          {column.name} · updated{" "}
          {formatRelative(task.updatedAt ?? task.createdAt)}
        </SheetDescription>
      </SheetHeader>

      <dl className="grid grid-cols-[7rem_1fr] gap-y-2.5 text-sm">
        <Prop label="Status">
          <span className="inline-flex items-center gap-1.5">
            <Dot color={column.color ?? "#ffffff55"} />
            {column.name}
          </span>
        </Prop>
        {task.priority !== "none" ? (
          <Prop label="Priority">
            <PriorityInline priority={task.priority as Priority} />
          </Prop>
        ) : null}
        {assignee ? (
          <Prop label="Assignee">
            <span className="inline-flex items-center gap-2">
              <UserAvatar
                image={assignee.image}
                name={assignee.name}
                size={20}
              />
              {assignee.name}
            </span>
          </Prop>
        ) : null}
        {task.dueAt ? (
          <Prop label="Due">
            <span className={cn(overdue && "text-danger")}>
              {formatDate(task.dueAt)}
              {overdue ? " · overdue" : ""}
            </span>
          </Prop>
        ) : null}
        {labels.length > 0 ? (
          <Prop label="Labels">
            <span className="flex flex-wrap gap-1.5">
              {labels.map((l) => (
                <Badge color={l.color} key={l.id}>
                  {l.name}
                </Badge>
              ))}
            </span>
          </Prop>
        ) : null}
      </dl>

      {task.description ? (
        <section className="border-t border-white/10 pt-4">
          <RichTextContent className="text-sm" value={task.description} />
        </section>
      ) : null}

      {checklist.length > 0 ? (
        <section className="flex flex-col gap-2 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span className="font-medium text-white/70">Checklist</span>
            <span className="tabular-nums">
              {checked}/{checklist.length}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="bg-success h-full rounded-full transition-[width]"
              style={{ width: `${(checked / checklist.length) * 100}%` }}
            />
          </div>
          <ul className="flex flex-col gap-1.5">
            {checklist.map((item) => (
              <li className="flex items-start gap-2 text-sm" key={item.id}>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    item.done
                      ? "border-success/50 bg-success/15 text-success"
                      : "border-white/20",
                  )}
                >
                  {item.done ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className={cn(item.done && "text-white/40 line-through")}>
                  <span className="sr-only">
                    {item.done ? "Done: " : "To do: "}
                  </span>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-white/40">{label}</dt>
      <dd className="min-w-0 text-white/90">{children}</dd>
    </>
  );
}
