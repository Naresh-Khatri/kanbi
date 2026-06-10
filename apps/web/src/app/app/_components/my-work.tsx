"use client";

import { AlertTriangle, AtSign, CalendarClock, ListTodo } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import {
  type Priority,
  PriorityIcon,
} from "@/app/app/p/[slug]/_components/priority";
import { isDoneLikeColumn } from "@/lib/column-heuristics";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

type Assigned = RouterOutputs["user"]["myWork"]["assigned"][number];
type Mention = RouterOutputs["user"]["myWork"]["mentions"][number];

const DAY_MS = 24 * 60 * 60 * 1000;

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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TaskSection
            danger
            icon={<AlertTriangle className="h-4 w-4" />}
            tasks={overdue}
            title="Overdue"
          />
          <TaskSection
            icon={<CalendarClock className="h-4 w-4" />}
            tasks={dueSoon}
            title="Due soon"
          />
          <TaskSection
            icon={<ListTodo className="h-4 w-4" />}
            tasks={later}
            title="Assigned to me"
          />
          <MentionsSection mentions={data.mentions} />
        </div>
      )}
    </section>
  );
}

function TaskSection({
  title,
  tasks,
  icon,
  danger,
}: {
  title: string;
  tasks: Assigned[];
  icon: React.ReactNode;
  danger?: boolean;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <span className={cn("text-white/60", danger && "text-red-400/80")}>
          {icon}
        </span>
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs text-white/40">{tasks.length}</span>
      </div>
      <ul className="flex flex-col">
        {tasks.map((t) => (
          <li key={t.id}>
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
                  {new Date(t.dueAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              ) : null}
              <span className="shrink-0 truncate text-xs text-white/40">
                {t.projectName}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MentionsSection({ mentions }: { mentions: Mention[] }) {
  if (mentions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <span className="text-white/60">
          <AtSign className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-medium">Recently mentioned</h2>
        <span className="text-xs text-white/40">{mentions.length}</span>
      </div>
      <ul className="flex flex-col">
        {mentions.map((m) => {
          const body = (
            <>
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="text-white/80">{m.actorName ?? "Someone"}</span>
                <span className="text-white/50"> mentioned you</span>
                {m.taskTitle ? (
                  <span className="text-white/80"> in “{m.taskTitle}”</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-white/40">
                {new Date(m.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          );
          return (
            <li key={m.id}>
              {m.taskId && m.projectSlug ? (
                <Link
                  className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-white/5"
                  href={`/app/p/${m.projectSlug}?task=${m.taskId}`}
                >
                  {body}
                </Link>
              ) : (
                <span className="-mx-2 flex items-center gap-2 px-2 py-1.5">
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
