"use client";

import { formatDate, formatRelative } from "@kanbi/shared";
import {
  Columns3Icon,
  EyeIcon,
  Link2Icon,
  ListIcon,
  SearchIcon,
  SearchXIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toastManager } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
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
type Focus = "started" | "dueSoon" | "overdue";

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
  const [focus, setFocus] = useState<Focus | null>(null);
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
      if (focus && !matchesFocus(v, focus)) return false;
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
  }, [views, query, labelIds, assigneeId, hideDone, focus]);

  const byColumn = useMemo(() => {
    const map = new Map<string, TaskView[]>(columns.map((c) => [c.id, []]));
    for (const v of filtered) map.get(v.column.id)?.push(v);
    return map;
  }, [columns, filtered]);

  const visibleColumns = hideDone
    ? columns.filter((c) => !DONE_CATEGORIES.has(c.category))
    : columns;
  const filtering =
    query.trim() !== "" ||
    labelIds.size > 0 ||
    assigneeId != null ||
    hideDone ||
    focus != null;
  const openView = openKey ? views.find((v) => v.key === openKey) : undefined;

  function clearFilters() {
    setQuery("");
    setLabelIds(new Set());
    setAssigneeId(null);
    setHideDone(false);
    setFocus(null);
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: board.projectColor ?? DEFAULT_PROJECT_COLOR }}
          />
          <h1 className="min-w-0 truncate text-base font-semibold sm:text-lg">
            {board.projectName}
          </h1>
          <Badge className="max-sm:hidden" variant="outline">
            <EyeIcon aria-hidden="true" /> View only
          </Badge>
          <div className="ms-auto flex items-center gap-3">
            {data.updatedAt ? (
              <span className="text-muted-foreground text-xs max-md:hidden">
                Updated {formatRelative(data.updatedAt)}
              </span>
            ) : null}
            <Button
              onClick={() => {
                const url = new URL(window.location.href);
                url.search = "";
                void navigator.clipboard.writeText(url.toString());
                toastManager.add({
                  type: "success",
                  title: "Board link copied",
                });
              }}
              size="sm"
              variant="outline"
            >
              <Link2Icon aria-hidden="true" />
              <span className="max-sm:sr-only">Copy link</span>
            </Button>
          </div>
        </div>
      </header>

      <Overview
        data={data}
        focus={focus}
        onFocus={(f) => setFocus((cur) => (cur === f ? null : f))}
        views={views}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-4 sm:px-6">
        <InputGroup className="min-w-0 flex-1 sm:w-64 sm:flex-none">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search tasks"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            placeholder="Search tasks"
            ref={searchRef}
            size="sm"
            value={query}
          />
          {query ? null : (
            <InputGroupAddon align="inline-end">
              <Kbd>/</Kbd>
            </InputGroupAddon>
          )}
        </InputGroup>
        {/* mobile: own full-bleed row that scrolls sideways instead of wrapping */}
        <div className="flex items-center gap-x-3 gap-y-2 max-sm:order-last max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] sm:flex-wrap">
          {data.labels.length > 0 ? <ToolbarDivider /> : null}
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
          <ToolbarDivider />
          {data.assignees.length > 0 ? (
            <div className="flex shrink-0 items-center gap-0.5">
              {data.assignees.map((a) => (
                <Tooltip key={a.id}>
                  <TooltipTrigger
                    render={
                      <Toggle
                        aria-label={`Only ${a.name}'s tasks`}
                        className={cn(
                          "rounded-full",
                          assigneeId && assigneeId !== a.id && "opacity-48",
                        )}
                        onPressedChange={() =>
                          setAssigneeId((cur) => (cur === a.id ? null : a.id))
                        }
                        pressed={assigneeId === a.id}
                        size="sm"
                      />
                    }
                  >
                    <UserAvatar image={a.image} name={a.name} size={22} />
                  </TooltipTrigger>
                  <TooltipPopup>{a.name}</TooltipPopup>
                </Tooltip>
              ))}
            </div>
          ) : null}
          <Toggle
            className="rounded-full px-3 text-xs font-normal"
            onPressedChange={() => setHideDone((v) => !v)}
            pressed={hideDone}
            size="sm"
            variant="outline"
          >
            Hide done
          </Toggle>
          {filtering ? (
            <Button onClick={clearFilters} size="sm" variant="ghost">
              <XIcon aria-hidden="true" /> Clear
            </Button>
          ) : null}
        </div>
        <ToggleGroup
          className="ms-auto"
          onValueChange={(value) => {
            const next = value[0] as Layout | undefined;
            if (next) setLayout(next);
          }}
          size="sm"
          value={[layout]}
          variant="outline"
        >
          <ToggleGroupItem aria-label="Board view" value="board">
            <Columns3Icon aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem aria-label="List view" value="list">
            <ListIcon aria-hidden="true" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filtering && filtered.length === 0 ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No matching tasks</EmptyTitle>
            <EmptyDescription>No tasks match these filters.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={clearFilters} size="sm" variant="outline">
              Clear filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : layout === "board" ? (
        <div className="mx-auto w-full max-w-7xl flex-1 snap-x snap-mandatory scroll-px-4 overflow-x-auto sm:snap-none">
          <div className="flex w-max min-w-full items-start gap-3 px-4 pb-8 sm:px-6">
            {visibleColumns.map((col) => {
              const items = byColumn.get(col.id) ?? [];
              return (
                <section
                  aria-label={col.name}
                  className="bg-muted flex w-[85vw] shrink-0 snap-start flex-col gap-2 rounded-xl p-2 sm:w-auto sm:max-w-md sm:min-w-72 sm:flex-1"
                  key={col.id}
                >
                  <ColumnHeading
                    color={col.color}
                    count={items.length}
                    name={col.name}
                  />
                  {items.length === 0 ? (
                    <p className="text-muted-foreground/72 rounded-lg border border-dashed px-2 py-5 text-center text-xs">
                      No tasks
                    </p>
                  ) : (
                    items.map((v, i) => (
                      <PublicTaskCard
                        index={i}
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
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pb-8 sm:px-6">
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
                {items.map((v, i) => (
                  <PublicTaskCard
                    compact
                    index={i}
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

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs sm:px-6">
          <span>
            Read-only snapshot
            {data.expiresAt
              ? ` · link expires ${formatDate(data.expiresAt)}`
              : ""}
          </span>
          <Link
            className="hover:text-foreground inline-flex items-center gap-1.5 rounded-sm"
            href="/"
          >
            <Logo className="size-4" /> Made with Kanbi
          </Link>
        </div>
      </footer>

      <PublicTaskSheet
        onClose={() => setOpenKey(null)}
        view={openView ?? null}
      />
    </main>
  );
}

function Overview({
  data,
  views,
  focus,
  onFocus,
}: {
  data: PublicBoard;
  views: TaskView[];
  focus: Focus | null;
  onFocus: (f: Focus) => void;
}) {
  const stats = useMemo(() => {
    let done = 0;
    let started = 0;
    let overdue = 0;
    let dueSoon = 0;
    for (const v of views) {
      if (v.done) {
        done++;
        continue;
      }
      if (matchesFocus(v, "started")) started++;
      if (matchesFocus(v, "overdue")) overdue++;
      else if (matchesFocus(v, "dueSoon")) dueSoon++;
    }
    return { total: views.length, done, started, overdue, dueSoon };
  }, [views]);

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 pt-5 pb-4 sm:px-6">
      {data.board.projectDescription ? (
        <p className="text-muted-foreground max-w-2xl text-sm">
          {data.board.projectDescription}
        </p>
      ) : null}
      {/* gap-px over bg-border = hairline dividers that survive wrapping */}
      <div className="bg-border grid grid-cols-3 gap-px overflow-hidden rounded-xl border sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="bg-card col-span-3 flex flex-col justify-center gap-2 px-3 py-3 sm:col-span-1 sm:px-4">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-muted-foreground">Complete</span>
            <span className="text-muted-foreground tabular-nums">
              {stats.done} of {stats.total} tasks
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-11 text-lg font-semibold tabular-nums">
              {pct}%
            </span>
            <Progress
              aria-label={`${pct}% of tasks complete`}
              className="flex-1"
              value={pct}
            >
              <ProgressTrack>
                <ProgressIndicator className="bg-success" />
              </ProgressTrack>
            </Progress>
          </div>
        </div>
        <Stat
          active={focus === "started"}
          label="In progress"
          onClick={() => onFocus("started")}
          value={stats.started}
        />
        <Stat
          active={focus === "dueSoon"}
          label="Due this week"
          onClick={() => onFocus("dueSoon")}
          value={stats.dueSoon}
        />
        <Stat
          active={focus === "overdue"}
          label="Overdue"
          onClick={() => onFocus("overdue")}
          tone={stats.overdue > 0 ? "danger" : undefined}
          value={stats.overdue}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "danger";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "bg-card relative flex cursor-pointer touch-manipulation flex-col items-start gap-0.5 px-3 py-3 text-left text-xs outline-none sm:px-4",
        "hover:bg-accent focus-visible:ring-ring transition-colors duration-150 ease-out focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset",
        "disabled:hover:bg-card disabled:cursor-default",
        // selected = filter on -> underline bar, not just a tint
        "after:bg-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:opacity-0 after:transition-opacity sm:after:inset-x-4",
        active && "bg-accent hover:bg-accent after:opacity-100",
      )}
      disabled={value === 0 && !active}
      onClick={onClick}
      title={active ? "Show all tasks" : `Show only ${label.toLowerCase()}`}
      type="button"
    >
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "danger" ? "text-destructive-foreground" : "text-foreground",
          value === 0 && !active && "text-muted-foreground/64",
        )}
      >
        {value}
      </span>
    </button>
  );
}

function ToolbarDivider() {
  return <Separator className="h-5 max-sm:hidden" orientation="vertical" />;
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
    <div className="flex shrink-0 items-center gap-1 sm:shrink sm:flex-wrap">
      {labels.map((l) => (
        <Toggle
          className="gap-1.5 rounded-full ps-2.5 pe-3 text-xs font-normal"
          key={l.id}
          onPressedChange={() => onToggle(l.id)}
          pressed={selected.has(l.id)}
          size="sm"
          variant="outline"
        >
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full"
            style={{ background: l.color }}
          />
          {l.name}
        </Toggle>
      ))}
    </div>
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
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ background: color ?? "var(--color-muted-foreground)" }}
      />
      <h2 className="text-sm font-medium">{name}</h2>
      <span className="text-muted-foreground text-xs tabular-nums">
        {count}
      </span>
    </div>
  );
}

function matchesFocus(v: TaskView, focus: Focus): boolean {
  if (v.done) return false;
  if (focus === "started") return v.column.category === "started";
  if (focus === "overdue") return v.overdue;
  return (
    !v.overdue &&
    v.task.dueAt != null &&
    v.task.dueAt.getTime() - Date.now() < WEEK_MS
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
