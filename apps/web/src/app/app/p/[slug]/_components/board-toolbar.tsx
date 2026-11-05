"use client";

import {
  Archive,
  CalendarClock,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  User,
  X,
} from "lucide-react";
import { forwardRef } from "react";
import { CountBadge, Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxBox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { UserAvatar } from "@/components/ui/user-avatar";
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
    archivedCount: number;
    onOpenArchive: () => void;
    onOpenDigest: () => void;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
  }
>(function BoardToolbar(
  {
    filters,
    onChange,
    labels,
    members,
    visibleCount,
    totalCount,
    archivedCount,
    onOpenArchive,
    onOpenDigest,
    expanded,
    onExpandedChange,
  },
  searchRef,
) {
  const active = hasActiveFilters(filters);
  const hidden = totalCount - visibleCount;
  const filterCount =
    filters.priorities.length +
    filters.labelIds.length +
    filters.assigneeIds.length +
    (filters.due === "any" ? 0 : 1);
  const showControls = expanded || active;

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((x) => x !== value)
      : [...list, value];
  }

  function openSearch() {
    onExpandedChange(true);
    requestAnimationFrame(() => {
      if (searchRef && typeof searchRef !== "function") {
        searchRef.current?.focus();
      }
    });
  }

  return (
    <div className="border-b border-white/10">
      <div className="flex items-center gap-1 px-6 py-2">
        <Button
          aria-controls="board-search-filters"
          aria-expanded={showControls}
          className="gap-1.5"
          onClick={openSearch}
          size="sm"
          variant={filters.query ? "selected" : "toolbar"}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
          <Kbd variant="hint">/</Kbd>
        </Button>
        <Button
          aria-controls="board-search-filters"
          aria-expanded={showControls}
          className="gap-1.5"
          onClick={() => onExpandedChange(!expanded)}
          size="sm"
          variant={filterCount > 0 ? "selected" : "toolbar"}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filters</span>
          {filterCount > 0 ? (
            <CountBadge tone="info">{filterCount}</CountBadge>
          ) : null}
        </Button>
        {active ? (
          <span className="ml-1 text-xs text-white/40">
            {hidden > 0 ? `${hidden} hidden` : "Showing all"}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <Button
            className="gap-1.5"
            onClick={onOpenDigest}
            size="sm"
            variant="property"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Digest</span>
          </Button>
          {archivedCount > 0 ? (
            <Button
              className="gap-1.5"
              onClick={onOpenArchive}
              size="sm"
              variant="property"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Archive</span>
              <CountBadge>{archivedCount}</CountBadge>
            </Button>
          ) : null}
        </div>
      </div>

      {showControls ? (
        <div
          className="flex flex-wrap items-center gap-2 border-t border-white/10 px-6 py-2"
          id="board-search-filters"
        >
          <div className="relative max-w-sm min-w-48 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-white/40"
            />
            <Input
              aria-label="Search tasks"
              className="h-8 pr-8 pl-8"
              onChange={(e) => onChange({ ...filters, query: e.target.value })}
              placeholder="Search tasks…"
              ref={searchRef}
              value={filters.query}
            />
            {filters.query ? (
              <Button
                aria-label="Clear search"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => onChange({ ...filters, query: "" })}
                size="icon-sm"
                type="button"
                variant="quiet"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
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
              <div className="px-2 py-1.5 text-xs text-white/40">
                No labels yet
              </div>
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
                    <Dot color={l.color} size="md" />
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
              <span className="text-2xs flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/70">
                ?
              </span>
              <span>Unassigned</span>
            </FilterItem>
            {members.length > 0 ? <DropdownMenuSeparator /> : null}
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
            <Button
              onClick={() => {
                onChange(EMPTY_FILTERS);
                onExpandedChange(false);
              }}
              size="sm"
              variant="property"
            >
              Clear
            </Button>
          ) : (
            <Button
              aria-label="Hide search and filters"
              onClick={() => onExpandedChange(false)}
              size="icon"
              variant="quiet"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
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
          className="gap-1.5"
          disabled={disabled}
          size="sm"
          variant={count > 0 ? "selected" : "toolbar"}
        >
          {icon}
          <span>{label}</span>
          {count > 0 ? <CountBadge tone="info">{count}</CountBadge> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
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
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        onSelect();
      }}
    >
      <CheckboxBox checked={checked} tone="info" />
      {children}
    </DropdownMenuItem>
  );
}
