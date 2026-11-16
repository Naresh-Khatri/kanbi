"use client";

import {
  AtSignIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  ListTodoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  type Priority,
  PriorityIcon,
} from "@/app/app/p/[slug]/_components/priority";
import { formatDate, formatDateTime, formatRelative } from "@kanbi/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";
import { TodayQueue } from "./today-queue";
import { taskBoardHref } from "@/lib/task-link";

type Assigned = RouterOutputs["user"]["myWork"]["assigned"][number];
type Mention = RouterOutputs["user"]["myWork"]["mentions"][number];

const DAY_MS = 24 * 60 * 60 * 1000;
const PREVIEW = 6;

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function MyWork() {
  const [data] = api.user.myWork.useSuspenseQuery();
  const [today] = api.today.list.useSuspenseQuery();

  const { overdue, dueSoon, later } = useMemo(() => {
    const todayStart = startOfTodayMs();
    const weekEnd = todayStart + 7 * DAY_MS;
    const overdue: Assigned[] = [];
    const dueSoon: Assigned[] = [];
    const later: Assigned[] = [];
    for (const t of data.assigned) {
      if (t.columnCategory === "completed" || t.columnCategory === "canceled")
        continue;
      const due = t.dueAt ? new Date(t.dueAt).getTime() : null;
      if (due != null && due < todayStart) overdue.push(t);
      else if (due != null && due < weekEnd) dueSoon.push(t);
      else later.push(t);
    }
    return { overdue, dueSoon, later };
  }, [data.assigned]);

  const empty =
    today.length === 0 &&
    overdue.length === 0 &&
    dueSoon.length === 0 &&
    later.length === 0 &&
    data.mentions.length === 0;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold">My work</h2>
      <TodayQueue />
      {empty ? (
        <Empty className="rounded-2xl border border-dashed py-10 md:py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCheckIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>All clear</EmptyTitle>
            <EmptyDescription>
              Nothing assigned or mentioning you needs attention.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          <Section
            danger
            icon={<TriangleAlertIcon aria-hidden="true" />}
            items={overdue}
            renderItem={(t) => <TaskRow danger key={t.id} task={t} />}
            title="Overdue"
          />
          <Section
            icon={<CalendarClockIcon aria-hidden="true" />}
            items={dueSoon}
            renderItem={(t) => <TaskRow key={t.id} task={t} />}
            title="Due soon"
          />
          <Section
            icon={<ListTodoIcon aria-hidden="true" />}
            items={later}
            renderItem={(t) => <TaskRow key={t.id} task={t} />}
            title="Assigned to me"
          />
          <Section
            icon={<AtSignIcon aria-hidden="true" />}
            items={data.mentions}
            renderItem={(m) => <MentionRow key={m.id} mention={m} />}
            title="Recently mentioned"
          />
        </div>
      )}
    </section>
  );
}

// long lists flow into columns so they use page width instead of height
function Section<T>({
  title,
  items,
  icon,
  danger,
  renderItem,
}: {
  title: string;
  items: T[];
  icon: React.ReactNode;
  danger?: boolean;
  renderItem: (item: T) => React.ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;

  const overflow = items.length - PREVIEW;
  const visible = showAll ? items : items.slice(0, PREVIEW);
  const multiColumn = visible.length > 5;

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
        <span
          className={cn(
            "text-muted-foreground [&_svg]:size-4",
            danger && "text-destructive-foreground",
          )}
        >
          {icon}
        </span>
        <CardTitle className="font-sans text-sm font-medium">{title}</CardTitle>
        <Badge size="sm" variant={danger ? "error" : "secondary"}>
          {items.length}
        </Badge>
        {overflow > 0 ? (
          <CardAction className="ms-auto self-center">
            <Button
              onClick={() => setShowAll((v) => !v)}
              size="xs"
              type="button"
              variant="ghost"
            >
              {showAll ? "Show less" : `Show ${overflow} more`}
              <ChevronDownIcon
                aria-hidden="true"
                className={cn(
                  "transition-transform duration-200",
                  showAll && "rotate-180",
                )}
              />
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardPanel className="px-2 pt-0 pb-2">
        <ul
          className={cn(
            "gap-x-2",
            multiColumn
              ? "columns-1 sm:columns-2 xl:columns-3"
              : "flex flex-col",
          )}
        >
          {visible.map((item) => renderItem(item))}
        </ul>
      </CardPanel>
    </Card>
  );
}

const rowClass =
  "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent";

function TaskRow({ task: t, danger }: { task: Assigned; danger?: boolean }) {
  return (
    <li className="break-inside-avoid">
      <Link className={rowClass} href={taskBoardHref(t.projectSlug, t.number)}>
        <PriorityIcon
          className="size-3.5 shrink-0"
          priority={t.priority as Priority}
        />
        <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
        {t.dueAt ? (
          <span
            className={cn(
              "text-muted-foreground shrink-0 text-xs tabular-nums",
              danger && "text-destructive-foreground",
            )}
          >
            {formatDate(t.dueAt)}
          </span>
        ) : null}
        <span className="text-muted-foreground max-w-28 shrink-0 truncate text-xs">
          {t.projectName}
        </span>
      </Link>
    </li>
  );
}

function MentionRow({ mention: m }: { mention: Mention }) {
  const body = (
    <>
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="font-medium">{m.actorName ?? "Someone"}</span>
        <span className="text-muted-foreground"> mentioned you</span>
        {m.taskTitle ? <span> in “{m.taskTitle}”</span> : null}
      </span>
      <span
        className="text-muted-foreground shrink-0 text-xs"
        title={formatDateTime(m.createdAt)}
      >
        {formatRelative(m.createdAt)}
      </span>
    </>
  );
  return (
    <li className="break-inside-avoid">
      {m.taskId && m.projectSlug ? (
        <Link
          className={rowClass}
          href={
            m.taskNumber != null
              ? taskBoardHref(m.projectSlug, m.taskNumber)
              : `/app/p/${m.projectSlug}?task=${m.taskId}`
          }
        >
          {body}
        </Link>
      ) : (
        <span className="flex items-center gap-2 px-2 py-1.5">{body}</span>
      )}
    </li>
  );
}
