"use client";

import {
  AlertTriangle,
  AtSign,
  CalendarClock,
  ChevronDown,
  ListTodo,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  type Priority,
  PriorityIcon,
} from "@/app/app/p/[slug]/_components/priority";
import { formatDate, formatDateTime, formatRelative } from "@kanbi/shared";

import { isDoneLikeColumn } from "@/lib/column-heuristics";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

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

  const { overdue, dueSoon, later } = useMemo(() => {
    const todayStart = startOfTodayMs();
    const weekEnd = todayStart + 7 * DAY_MS;
    const overdue: Assigned[] = [];
    const dueSoon: Assigned[] = [];
    const later: Assigned[] = [];
    for (const t of data.assigned) {
      if (isDoneLikeColumn(t.columnName)) continue;
      const due = t.dueAt ? new Date(t.dueAt).getTime() : null;
      if (due != null && due < todayStart) overdue.push(t);
      else if (due != null && due < weekEnd) dueSoon.push(t);
      else later.push(t);
    }
    return { overdue, dueSoon, later };
  }, [data.assigned]);

  const empty =
    overdue.length === 0 &&
    dueSoon.length === 0 &&
    later.length === 0 &&
    data.mentions.length === 0;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">My work</h1>
        <p className="text-sm text-white/60">
          Everything on your plate, across every project.
        </p>
      </div>
      {empty ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
          Nothing assigned to you right now. Enjoy the calm.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Section
            danger
            icon={<AlertTriangle className="h-4 w-4" />}
            items={overdue}
            renderItem={(t) => <TaskRow danger key={t.id} task={t} />}
            title="Overdue"
          />
          <Section
            icon={<CalendarClock className="h-4 w-4" />}
            items={dueSoon}
            renderItem={(t) => <TaskRow key={t.id} task={t} />}
            title="Due soon"
          />
          <Section
            icon={<ListTodo className="h-4 w-4" />}
            items={later}
            renderItem={(t) => <TaskRow key={t.id} task={t} />}
            title="Assigned to me"
          />
          <Section
            icon={<AtSign className="h-4 w-4" />}
            items={data.mentions}
            renderItem={(m) => <MentionRow key={m.id} mention={m} />}
            title="Recently mentioned"
          />
        </div>
      )}
    </section>
  );
}

/**
 * A titled card that shows a short preview of its items and reveals the rest
 * inline. Short lists render as one compact column; longer ones flow into a
 * few columns so they use the page width instead of running off the bottom.
 */
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
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <span className={cn("text-white/60", danger && "text-red-400/80")}>
          {icon}
        </span>
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs text-white/40">{items.length}</span>
      </div>
      <ul
        className={cn(
          "gap-x-6",
          multiColumn ? "columns-1 sm:columns-2 xl:columns-3" : "flex flex-col",
        )}
      >
        {visible.map((item) => renderItem(item))}
      </ul>
      {overflow > 0 ? (
        <button
          className="mt-1 flex items-center gap-1 self-start text-xs text-white/50 transition hover:text-white/80"
          onClick={() => setShowAll((v) => !v)}
          type="button"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              showAll && "rotate-180",
            )}
          />
          {showAll ? "Show less" : `Show ${overflow} more`}
        </button>
      ) : null}
    </div>
  );
}

function TaskRow({ task: t, danger }: { task: Assigned; danger?: boolean }) {
  return (
    <li className="break-inside-avoid">
      <Link
        className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-white/5"
        href={`/app/p/${t.projectSlug}?task=${t.id}`}
      >
        <PriorityIcon
          className="h-3.5 w-3.5 shrink-0"
          priority={t.priority as Priority}
        />
        <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
        {t.dueAt ? (
          <span
            className={cn(
              "shrink-0 text-xs text-white/40",
              danger && "text-red-400/80",
            )}
          >
            {formatDate(t.dueAt)}
          </span>
        ) : null}
        <span className="max-w-[7rem] shrink-0 truncate text-xs text-white/40">
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
        <span className="text-white/80">{m.actorName ?? "Someone"}</span>
        <span className="text-white/50"> mentioned you</span>
        {m.taskTitle ? (
          <span className="text-white/80"> in “{m.taskTitle}”</span>
        ) : null}
      </span>
      <span
        className="shrink-0 text-xs text-white/40"
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
          className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-white/5"
          href={`/app/p/${m.projectSlug}?task=${m.taskId}`}
        >
          {body}
        </Link>
      ) : (
        <span className="-mx-2 flex items-center gap-2 px-2 py-1.5">{body}</span>
      )}
    </li>
  );
}
