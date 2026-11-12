"use client";

import { formatDate, formatRelative } from "@kanbi/shared";
import { CheckIcon, Link2Icon } from "lucide-react";
import { type ReactNode, useSyncExternalStore } from "react";

import {
  type Priority,
  PriorityInline,
} from "@/app/app/p/[slug]/_components/priority";
import { RichTextContent } from "@/components/rich-text/editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { TaskView } from "./public-types";

export function PublicTaskSheet({
  view,
  onClose,
}: {
  view: TaskView | null;
  onClose: () => void;
}) {
  const mobile = useIsMobile();
  return (
    <Drawer
      onOpenChange={(open) => !open && onClose()}
      open={view != null}
      position={mobile ? "bottom" : "right"}
    >
      <DrawerPopup
        className={mobile ? "max-h-[85dvh]" : "max-w-lg"}
        showBar={mobile}
        showCloseButton
      >
        {view ? <SheetBody view={view} /> : null}
      </DrawerPopup>
    </Drawer>
  );
}

function SheetBody({ view }: { view: TaskView }) {
  const { task, column, labels, assignee, checklist, overdue } = view;
  const checked = checklist.filter((c) => c.done).length;

  return (
    <>
      <DrawerHeader className="pe-12">
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <span className="font-mono tracking-wide">{view.key}</span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Copy link to this task"
                  onClick={() => {
                    void navigator.clipboard.writeText(window.location.href);
                    toastManager.add({
                      type: "success",
                      title: "Task link copied",
                    });
                  }}
                  size="icon-xs"
                  variant="ghost"
                />
              }
            >
              <Link2Icon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipPopup>Copy link</TooltipPopup>
          </Tooltip>
        </div>
        <DrawerTitle className="leading-snug">{task.title}</DrawerTitle>
        <DrawerDescription className="text-xs">
          {column.name} · updated{" "}
          {formatRelative(task.updatedAt ?? task.createdAt)}
        </DrawerDescription>
      </DrawerHeader>

      <DrawerPanel className="flex flex-col gap-5">
        <dl className="grid grid-cols-[6rem_1fr] items-center gap-y-2.5 text-sm sm:grid-cols-[7rem_1fr]">
          <Prop label="Status">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{
                  background: column.color ?? "var(--color-muted-foreground)",
                }}
              />
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
              <span className={cn(overdue && "text-destructive-foreground")}>
                {formatDate(task.dueAt)}
                {overdue ? " · overdue" : ""}
              </span>
            </Prop>
          ) : null}
          {labels.length > 0 ? (
            <Prop label="Labels">
              <span className="flex flex-wrap gap-1.5">
                {labels.map((l) => (
                  <Badge key={l.id} variant="outline">
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full"
                      style={{ background: l.color }}
                    />
                    {l.name}
                  </Badge>
                ))}
              </span>
            </Prop>
          ) : null}
        </dl>

        {task.description ? (
          <section className="border-t pt-4">
            <RichTextContent className="text-sm" value={task.description} />
          </section>
        ) : null}

        {checklist.length > 0 ? (
          <section className="flex flex-col gap-2 border-t pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground font-medium">Checklist</span>
              <span className="text-muted-foreground tabular-nums">
                {checked}/{checklist.length}
              </span>
            </div>
            <Progress
              aria-label="Checklist progress"
              max={checklist.length}
              value={checked}
            >
              <ProgressTrack className="h-1">
                <ProgressIndicator className="bg-success" />
              </ProgressTrack>
            </Progress>
            <ul className="flex flex-col gap-1.5">
              {checklist.map((item) => (
                <li className="flex items-start gap-2 text-sm" key={item.id}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                      item.done
                        ? "border-success/48 bg-success/16 text-success-foreground"
                        : "border-input",
                    )}
                  >
                    {item.done ? <CheckIcon className="size-3" /> : null}
                  </span>
                  <span
                    className={cn(
                      item.done && "text-muted-foreground line-through",
                    )}
                  >
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
      </DrawerPanel>
    </>
  );
}

const MOBILE_QUERY = "(max-width: 639px)";

function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(MOBILE_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground min-w-0">{children}</dd>
    </>
  );
}
