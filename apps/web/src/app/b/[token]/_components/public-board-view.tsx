"use client";

import { formatDate, formatRelative } from "@kanbi/shared";
import { Columns3, Eye, Link2, List, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge, Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Logo } from "@/components/ui/logo";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DEFAULT_PROJECT_COLOR } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { PublicTaskCard } from "./public-task-card";
import { PublicTaskSheet } from "./public-task-sheet";
import {
  DONE_CATEGORIES,
  type PublicBoard,
  type PublicChecklistItem,
  type PublicLabel,
  type TaskView,
} from "./public-types";
import { ShareUnavailable } from "./share-unavailable";

type Layout = "board" | "list";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function PublicBoardView({ token }: { token: string }) {
  // staleTime Infinity: the link is validated on load; don't refetch and risk
  // flipping to "exhausted" once recordView bumps the counter.
  const [data] = api.share.getPublic.useSuspenseQuery(
    { token },
    { staleTime: Infinity },
  );
  if (data.status !== "ok") return <ShareUnavailable status={data.status} />;
  return <BoardSnapshot data={data} />;
}

function BoardSnapshot({ data }: { data: PublicBoard }) {
  const { board, columns } = data;
  const views = useTaskViews(data);

  const [query, setQuery] = useState("");
  const [labelIds, setLabelIds] = useState<Set<string>>(new Set());
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [layout, setLayout] = useState<Layout>("board");
  const [openKey, setOpenKey] = useOpenTaskParam();
  const searchRef = useRef<HTMLInputElement>(null);

  // narrow screens read better as a list
  useEffect(() => {
    if (window.matchMedia("(max-width: 640px)").matches) setLayout("list");
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable=true]")) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return views.filter((v) => {
      if (hideDone && v.done) return false;
      if (assigneeId && v.task.assigneeId !== assigneeId) return false;
      if (labelIds.size > 0 && !v.labels.some((l) => labelIds.has(l.id))) {
        return false;
      }
      if (!q) return true;
      return (
        v.task.title.toLowerCase().includes(q) ||
        v.key.toLowerCase().includes(q) ||
        v.labels.some((l) => l.name.toLowerCase().includes(q))
      );
    });
  }, [views, query, labelIds, assigneeId, hideDone]);

  const byColumn = useMemo(() => {
    const map = new Map<string, TaskView[]>(columns.map((c) => [c.id, []]));
    for (const v of filtered) map.get(v.column.id)?.push(v);
    return map;
  }, [columns, filtered]);

  const visibleColumns = hideDone
    ? columns.filter((c) => !DONE_CATEGORIES.has(c.category))
    : columns;
  const filtering =
    query.trim() !== "" || labelIds.size > 0 || assigneeId != null || hideDone;
  const openView = openKey ? views.find((v) => v.key === openKey) : undefined;

  function clearFilters() {
    setQuery("");
    setLabelIds(new Set());
    setAssigneeId(null);
    setHideDone(false);
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="bg-canvas/80 sticky top-0 z-40 border-b border-white/10 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <Dot color={board.projectColor ?? DEFAULT_PROJECT_COLOR} size="lg" />
          <h1 className="min-w-0 truncate text-base font-semibold sm:text-lg">
            {board.projectName}
          </h1>
          <Badge className="hidden sm:inline-flex">
            <Eye className="h-3 w-3" /> View only
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            {data.updatedAt ? (
              <span className="hidden text-xs text-white/40 md:inline">
                Updated {formatRelative(data.updatedAt)}
              </span>
            ) : null}
            <Button
              onClick={() => {
                const url = new URL(window.location.href);
                url.search = "";
                void navigator.clipboard.writeText(url.toString());
                toast.success("Board link copied");
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Copy link</span>
            </Button>
          </div>
        </div>
      </header>

      <Overview data={data} views={views} />

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <Input
            aria-label="Search tasks"
            className="h-8 pr-8 pl-8 text-sm"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            placeholder="Search tasks"
            ref={searchRef}
            value={query}
          />
          {query ? null : (
            <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
          )}
        </div>
        <LabelFilter
          labels={data.labels}
          onToggle={(id) =>
            setLabelIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          selected={labelIds}
        />
        {data.assignees.length > 0 ? (
          <div className="flex items-center gap-1">
            {data.assignees.map((a) => (
              <button
                aria-label={`Only ${a.name}'s tasks`}
                aria-pressed={assigneeId === a.id}
                className={cn(
                  "rounded-full ring-2 transition-opacity",
                  assigneeId === a.id ? "ring-info" : "ring-transparent",
                  assigneeId && assigneeId !== a.id && "opacity-40",
                )}
                key={a.id}
                onClick={() =>
                  setAssigneeId((cur) => (cur === a.id ? null : a.id))
                }
                title={a.name}
                type="button"
              >
                <UserAvatar image={a.image} name={a.name} size={24} />
              </button>
            ))}
          </div>
        ) : null}
        <Button
          aria-pressed={hideDone}
          onClick={() => setHideDone((v) => !v)}
          size="xs"
          type="button"
          variant={hideDone ? "selected" : "toolbar"}
        >
          Hide done
        </Button>
        {filtering ? (
          <Button
            onClick={clearFilters}
            size="xs"
            type="button"
            variant="quiet"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
        <div className="ml-auto flex rounded-md border border-white/15 p-0.5">
          <LayoutButton
            active={layout === "board"}
            label="Board"
            onClick={() => setLayout("board")}
          >
            <Columns3 className="h-3.5 w-3.5" />
          </LayoutButton>
          <LayoutButton
            active={layout === "list"}
            label="List"
            onClick={() => setLayout("list")}
          >
            <List className="h-3.5 w-3.5" />
          </LayoutButton>
        </div>
      </div>

      {filtering && filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <p className="text-sm text-white/60">No tasks match these filters.</p>
          <Button onClick={clearFilters} size="sm" variant="outline">
            Clear filters
          </Button>
        </div>
      ) : layout === "board" ? (
        <div className="flex-1 snap-x snap-mandatory overflow-x-auto sm:snap-none">
          <div className="flex min-w-max gap-3 px-4 pb-6 sm:px-6">
            {visibleColumns.map((col) => {
              const items = byColumn.get(col.id) ?? [];
              return (
                <section
                  aria-label={col.name}
                  className="flex w-[85vw] shrink-0 snap-start flex-col gap-2 rounded-xl bg-white/[0.03] p-2 sm:w-72"
                  key={col.id}
                >
                  <ColumnHeading
                    color={col.color}
                    count={items.length}
                    name={col.name}
                  />
                  {items.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-white/25">
                      Nothing here
                    </p>
                  ) : (
                    items.map((v) => (
                      <PublicTaskCard
                        key={v.task.id}
                        onOpen={() => setOpenKey(v.key)}
                        view={v}
                      />
                    ))
                  )}
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pb-6 sm:px-6">
          {visibleColumns.map((col) => {
            const items = byColumn.get(col.id) ?? [];
            if (items.length === 0) return null;
            return (
              <section
                aria-label={col.name}
                className="flex flex-col gap-1.5"
                key={col.id}
              >
                <ColumnHeading
                  color={col.color}
                  count={items.length}
                  name={col.name}
                />
                {items.map((v) => (
                  <PublicTaskCard
                    compact
                    key={v.task.id}
                    onOpen={() => setOpenKey(v.key)}
                    view={v}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-4 text-xs text-white/40 sm:px-6">
        <span>
          Read-only snapshot
          {data.expiresAt
            ? ` · link expires ${formatDate(data.expiresAt)}`
            : ""}
        </span>
        <Link
          className="inline-flex items-center gap-1.5 text-white/60 transition-colors hover:text-white"
          href="/"
        >
          <Logo className="h-4 w-4" /> Made with Kanbi
        </Link>
      </footer>

      <PublicTaskSheet
        onClose={() => setOpenKey(null)}
        view={openView ?? null}
      />
    </main>
  );
}

function Overview({ data, views }: { data: PublicBoard; views: TaskView[] }) {
  const stats = useMemo(() => {
    const now = Date.now();
    let done = 0;
    let started = 0;
    let overdue = 0;
    let dueSoon = 0;
    for (const v of views) {
      if (v.done) {
        done++;
        continue;
      }
      if (v.column.category === "started") started++;
      if (v.overdue) overdue++;
      else if (v.task.dueAt && v.task.dueAt.getTime() - now < WEEK_MS) {
        dueSoon++;
      }
    }
    return { total: views.length, done, started, overdue, dueSoon };
  }, [views]);

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
      {data.board.projectDescription ? (
        <p className="max-w-2xl text-sm text-white/60">
          {data.board.projectDescription}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5 sm:max-w-sm">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-white/60">
              <span className="text-lg font-semibold text-white tabular-nums">
                {pct}%
              </span>{" "}
              complete
            </span>
            <span className="text-white/40 tabular-nums">
              {stats.done} of {stats.total}
            </span>
          </div>
          <div
            aria-label={`${pct}% of tasks complete`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={pct}
            className="h-1.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
          >
            <div
              className="bg-success h-full rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <dl className="flex gap-6 text-xs">
          <Stat label="In progress" value={stats.started} />
          <Stat label="Due this week" value={stats.dueSoon} />
          <Stat
            label="Overdue"
            tone={stats.overdue > 0 ? "danger" : undefined}
            value={stats.overdue}
          />
        </dl>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <div className="flex flex-col">
      <dd
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "danger" ? "text-danger" : "text-white",
        )}
      >
        {value}
      </dd>
      <dt className="order-first text-white/40">{label}</dt>
    </div>
  );
}

function LabelFilter({
  labels,
  selected,
  onToggle,
}: {
  labels: PublicLabel[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (labels.length === 0) return null;
  return (
    <div className="flex max-w-full flex-wrap items-center gap-1">
      {labels.map((l) => {
        const on = selected.has(l.id);
        return (
          <button
            aria-pressed={on}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
              on
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/10 text-white/60 hover:border-white/20 hover:text-white",
            )}
            key={l.id}
            onClick={() => onToggle(l.id)}
            type="button"
          >
            <Dot color={l.color} size="xs" />
            {l.name}
          </button>
        );
      })}
    </div>
  );
}

function LayoutButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={`${label} view`}
      aria-pressed={active}
      className={cn(
        "flex h-6 w-7 items-center justify-center rounded transition-colors",
        active ? "bg-white/10 text-white" : "text-white/40 hover:text-white",
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function ColumnHeading({
  name,
  color,
  count,
}: {
  name: string;
  color: string | null;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-1.5 py-1">
      <Dot color={color ?? "#ffffff40"} />
      <h2 className="text-sm font-medium">{name}</h2>
      <span className="text-xs text-white/40 tabular-nums">{count}</span>
    </div>
  );
}

function useTaskViews(data: PublicBoard): TaskView[] {
  return useMemo(() => {
    const now = Date.now();
    const columnById = new Map(data.columns.map((c) => [c.id, c]));
    const labelById = new Map(data.labels.map((l) => [l.id, l]));
    const assigneeById = new Map(data.assignees.map((a) => [a.id, a]));
    const labelsByTask = new Map<string, PublicLabel[]>();
    for (const tl of data.taskLabels) {
      const l = labelById.get(tl.labelId);
      if (!l) continue;
      const list = labelsByTask.get(tl.taskId) ?? [];
      list.push(l);
      labelsByTask.set(tl.taskId, list);
    }
    const checklistByTask = new Map<string, PublicChecklistItem[]>();
    for (const c of data.checklist) {
      const list = checklistByTask.get(c.taskId) ?? [];
      list.push(c);
      checklistByTask.set(c.taskId, list);
    }

    const out: TaskView[] = [];
    for (const task of data.tasks) {
      const column = columnById.get(task.columnId);
      if (!column) continue;
      const done = DONE_CATEGORIES.has(column.category);
      out.push({
        task,
        column,
        key: `${data.board.projectKey}-${task.number}`,
        labels: labelsByTask.get(task.id) ?? [],
        assignee: task.assigneeId
          ? (assigneeById.get(task.assigneeId) ?? null)
          : null,
        checklist: checklistByTask.get(task.id) ?? [],
        done,
        overdue: !done && task.dueAt != null && task.dueAt.getTime() < now,
      });
    }
    return out;
  }, [data]);
}

// ?task=KEY-12 so a viewer can link straight to one card
function useOpenTaskParam() {
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    const read = () =>
      setKey(new URL(window.location.href).searchParams.get("task"));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const update = useCallback((next: string | null) => {
    setKey(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("task", next);
    else url.searchParams.delete("task");
    window.history.replaceState(null, "", url);
  }, []);

  return [key, update] as const;
}
