"use client";

import {
  CalendarClock,
  Check,
  Search,
  SlidersHorizontal,
  Tag,
  User,
  X,
} from "lucide-react";
import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import {
  PRIORITIES,
  PRIORITY_META,
  type Priority,
  PriorityIcon,
} from "./priority";

export type DueFilter = "any" | "overdue" | "today" | "week" | "none";

export type BoardFilters = {
  query: string;
  priorities: Priority[];
  labelIds: string[];
  /** "__unassigned__" is a sentinel meaning "tasks with no assignee". */
  assigneeIds: string[];
  due: DueFilter;
};

export const UNASSIGNED = "__unassigned__";

export const EMPTY_FILTERS: BoardFilters = {
  query: "",
  priorities: [],
  labelIds: [],
  assigneeIds: [],
  due: "any",
};

export function hasActiveFilters(f: BoardFilters): boolean {
  return (
    f.query.trim().length > 0 ||
    f.priorities.length > 0 ||
    f.labelIds.length > 0 ||
    f.assigneeIds.length > 0 ||
    f.due !== "any"
  );
}

type FilterTask = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assigneeId: string | null;
  dueAt: Date | null;
};

export function taskMatchesFilters(
  task: FilterTask,
  taskLabelIds: Set<string>,
  filters: BoardFilters,
): boolean {
  const q = filters.query.trim().toLowerCase();
  if (q) {
    const title = task.title.toLowerCase();
    const desc = (task.description ?? "").toLowerCase();
    if (!title.includes(q) && !desc.includes(q)) return false;
  }
  if (filters.priorities.length > 0) {
    if (!filters.priorities.includes(task.priority as Priority)) return false;
  }
  if (filters.assigneeIds.length > 0) {
    const wantsUnassigned = filters.assigneeIds.includes(UNASSIGNED);
    const matchesUser =
      task.assigneeId !== null && filters.assigneeIds.includes(task.assigneeId);
    const matchesUnassigned = wantsUnassigned && task.assigneeId === null;
    if (!matchesUser && !matchesUnassigned) return false;
  }
  if (filters.labelIds.length > 0) {
    const any = filters.labelIds.some((id) => taskLabelIds.has(id));
    if (!any) return false;
  }
  if (filters.due !== "any") {
    if (filters.due === "none") {
      if (task.dueAt) return false;
    } else {
      if (!task.dueAt) return false;
      const now = new Date();
      const due = task.dueAt.getTime();
      if (filters.due === "overdue") {
        if (due >= now.getTime()) return false;
      } else if (filters.due === "today") {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        if (due < start.getTime() || due >= end.getTime()) return false;
      } else if (filters.due === "week") {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        if (due < start.getTime() || due >= end.getTime()) return false;
      }
    }
  }
  return true;
}

type BoardMember = {
  userId: string;
  name: string;
  image: string | null;
};

type BoardLabel = {
  id: string;
  name: string;
  color: string;
};

const DUE_LABEL: Record<DueFilter, string> = {
  any: "Any due",
  overdue: "Overdue",
  today: "Due today",
  week: "Due this week",
  none: "No due date",
};

export const BoardToolbar = forwardRef<
  HTMLInputElement,
  {
    filters: BoardFilters;
    onChange: (next: BoardFilters) => void;
    labels: BoardLabel[];
    members: BoardMember[];
    visibleCount: number;
    totalCount: number;
  }
>(function BoardToolbar(
  { filters, onChange, labels, members, visibleCount, totalCount },
  searchRef,
) {
  const active = hasActiveFilters(filters);
  const hidden = totalCount - visibleCount;

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((x) => x !== value)
      : [...list, value];
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-white/5 border-b px-6 py-2">
      <div className="relative min-w-0 max-w-sm flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-white/40"
        />
        <Input
          aria-label="Search tasks"
          className="h-8 pr-8 pl-8"
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Search tasks…  /"
          ref={searchRef}
          value={filters.query}
        />
        {filters.query ? (
          <button
            aria-label="Clear search"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-white/40 hover:text-white"
            onClick={() => onChange({ ...filters, query: "" })}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <FilterChip
        count={filters.priorities.length}
        icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
        label="Priority"
      >
        {PRIORITIES.map((p) => {
          const checked = filters.priorities.includes(p);
          return (
            <FilterItem
              checked={checked}
              key={p}
              onSelect={() =>
                onChange({
                  ...filters,
                  priorities: toggle(filters.priorities, p),
                })
              }
            >
              <PriorityIcon className="h-3.5 w-3.5" priority={p} />
              <span>{PRIORITY_META[p].label}</span>
            </FilterItem>
          );
        })}
      </FilterChip>

      <FilterChip
        count={filters.labelIds.length}
        disabled={labels.length === 0}
        icon={<Tag className="h-3.5 w-3.5" />}
        label="Labels"
      >
        {labels.length === 0 ? (
          <div className="px-2 py-1.5 text-white/50 text-xs">No labels yet</div>
        ) : (
          labels.map((l) => {
            const checked = filters.labelIds.includes(l.id);
            return (
              <FilterItem
                checked={checked}
                key={l.id}
                onSelect={() =>
                  onChange({
                    ...filters,
                    labelIds: toggle(filters.labelIds, l.id),
                  })
                }
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: l.color }}
                />
                <span className="truncate">{l.name}</span>
              </FilterItem>
            );
          })
        )}
      </FilterChip>

      <FilterChip
        count={filters.assigneeIds.length}
        icon={<User className="h-3.5 w-3.5" />}
        label="Assignee"
      >
        <FilterItem
          checked={filters.assigneeIds.includes(UNASSIGNED)}
          onSelect={() =>
            onChange({
              ...filters,
              assigneeIds: toggle(filters.assigneeIds, UNASSIGNED),
            })
          }
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] text-white/60">
            ?
          </span>
          <span>Unassigned</span>
        </FilterItem>
        {members.length > 0 ? <div className="my-1 h-px bg-white/10" /> : null}
        {members.map((m) => {
          const checked = filters.assigneeIds.includes(m.userId);
          return (
            <FilterItem
              checked={checked}
              key={m.userId}
              onSelect={() =>
                onChange({
                  ...filters,
                  assigneeIds: toggle(filters.assigneeIds, m.userId),
                })
              }
            >
              <UserAvatar image={m.image} name={m.name} size={20} />
              <span className="truncate">{m.name}</span>
            </FilterItem>
          );
        })}
      </FilterChip>

      <FilterChip
        count={filters.due === "any" ? 0 : 1}
        icon={<CalendarClock className="h-3.5 w-3.5" />}
        label={filters.due === "any" ? "Due" : DUE_LABEL[filters.due]}
      >
        {(Object.keys(DUE_LABEL) as DueFilter[]).map((d) => (
          <FilterItem
            checked={filters.due === d}
            key={d}
            onSelect={() => onChange({ ...filters, due: d })}
          >
            <span>{DUE_LABEL[d]}</span>
          </FilterItem>
        ))}
      </FilterChip>

      {active ? (
        <>
          <Button
            className="h-8 text-white/70 hover:text-white"
            onClick={() => onChange(EMPTY_FILTERS)}
            size="sm"
            variant="ghost"
          >
            Clear
          </Button>
          <span className="ml-auto text-white/60 text-xs">
            {hidden > 0 ? `${hidden} hidden` : "Showing all"}
          </span>
        </>
      ) : null}
    </div>
  );
});

function FilterChip({
  icon,
  label,
  count,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            "h-8 gap-1.5 border border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]",
            count > 0 && "border-sky-400/30 bg-sky-400/10 text-sky-200",
          )}
          disabled={disabled}
          size="sm"
          variant="ghost"
        >
          {icon}
          <span>{label}</span>
          {count > 0 ? (
            <span className="rounded bg-sky-400/20 px-1 text-[10px]">
              {count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterItem({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-white/10 focus:bg-white/10"
      onClick={(e) => {
        e.preventDefault();
        onSelect();
      }}
      type="button"
    >
      <span
        aria-hidden
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          checked
            ? "border-sky-400 bg-sky-400/20 text-sky-300"
            : "border-white/20",
        )}
      >
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      {children}
    </button>
  );
}
