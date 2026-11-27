"use client";

import {
  ArchiveIcon,
  BellDotIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  ListFilterIcon,
  SearchIcon,
  SignalHighIcon,
  SparklesIcon,
  TagIcon,
  UserIcon,
  UserRoundXIcon,
  XIcon,
} from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { Tip } from "./board/tip";
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
  /** only tasks with activity since the last visit */
  updated: boolean;
};

export const UNASSIGNED = "__unassigned__";

export const EMPTY_FILTERS: BoardFilters = {
  query: "",
  priorities: [],
  labelIds: [],
  assigneeIds: [],
  due: "any",
  updated: false,
};

export function hasActiveFilters(f: BoardFilters): boolean {
  return (
    f.query.trim().length > 0 ||
    f.priorities.length > 0 ||
    f.labelIds.length > 0 ||
    f.assigneeIds.length > 0 ||
    f.due !== "any" ||
    f.updated
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
  updatedIds?: ReadonlySet<string>,
): boolean {
  if (filters.updated && !updatedIds?.has(task.id)) return false;
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
    updateCount: number;
    onMarkAllSeen: () => void;
    /** mobile only: filter row is collapsed behind the filters button */
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    /** milestone scope picker; scopes the board, so it sits before search */
    milestoneMenu?: ReactNode;
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
    updateCount,
    onMarkAllSeen,
    expanded,
    onExpandedChange,
    milestoneMenu,
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

  function toggle<T>(list: T[], value: T, on: boolean): T[] {
    const rest = list.filter((x) => x !== value);
    return on ? [...rest, value] : rest;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2 sm:px-6">
      {milestoneMenu}
      <InputGroup className="w-full sm:w-60">
        <InputGroupInput
          aria-label="Search tasks"
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            if (filters.query) onChange({ ...filters, query: "" });
            else e.currentTarget.blur();
          }}
          placeholder="Search tasks…"
          ref={searchRef}
          size="sm"
          type="search"
          value={filters.query}
        />
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          {filters.query ? (
            <Button
              aria-label="Clear search"
              onClick={() => onChange({ ...filters, query: "" })}
              size="icon-xs"
              variant="ghost"
            >
              <XIcon aria-hidden="true" />
            </Button>
          ) : (
            <Kbd>/</Kbd>
          )}
        </InputGroupAddon>
      </InputGroup>

      <Button
        aria-controls="board-filters"
        aria-expanded={expanded}
        className="sm:hidden"
        onClick={() => onExpandedChange(!expanded)}
        size="sm"
        variant="outline"
      >
        <ListFilterIcon aria-hidden="true" />
        Filters
        {filterCount > 0 ? (
          <Badge size="sm" variant="info">
            {filterCount}
          </Badge>
        ) : null}
      </Button>

      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5",
          !(expanded || active) && "max-sm:hidden",
        )}
        id="board-filters"
      >
        <FilterMenu
          count={filters.priorities.length}
          icon={<SignalHighIcon aria-hidden="true" />}
          label="Priority"
        >
          {PRIORITIES.map((p) => (
            <MenuCheckboxItem
              checked={filters.priorities.includes(p)}
              key={p}
              onCheckedChange={(on) =>
                onChange({
                  ...filters,
                  priorities: toggle(filters.priorities, p, on),
                })
              }
            >
              <PriorityIcon priority={p} />
              {PRIORITY_META[p].label}
            </MenuCheckboxItem>
          ))}
        </FilterMenu>

        <FilterMenu
          count={filters.labelIds.length}
          disabled={labels.length === 0}
          icon={<TagIcon aria-hidden="true" />}
          label="Labels"
        >
          {labels.map((l) => (
            <MenuCheckboxItem
              checked={filters.labelIds.includes(l.id)}
              key={l.id}
              onCheckedChange={(on) =>
                onChange({
                  ...filters,
                  labelIds: toggle(filters.labelIds, l.id, on),
                })
              }
            >
              <span
                aria-hidden="true"
                className="mx-1 size-2 shrink-0 rounded-full"
                style={{ backgroundColor: l.color }}
              />
              <span className="truncate">{l.name}</span>
            </MenuCheckboxItem>
          ))}
        </FilterMenu>

        <FilterMenu
          count={filters.assigneeIds.length}
          icon={<UserIcon aria-hidden="true" />}
          label="Assignee"
        >
          <MenuCheckboxItem
            checked={filters.assigneeIds.includes(UNASSIGNED)}
            onCheckedChange={(on) =>
              onChange({
                ...filters,
                assigneeIds: toggle(filters.assigneeIds, UNASSIGNED, on),
              })
            }
          >
            <UserRoundXIcon aria-hidden="true" />
            Unassigned
          </MenuCheckboxItem>
          {members.length > 0 ? <MenuSeparator /> : null}
          {members.map((m) => (
            <MenuCheckboxItem
              checked={filters.assigneeIds.includes(m.userId)}
              key={m.userId}
              onCheckedChange={(on) =>
                onChange({
                  ...filters,
                  assigneeIds: toggle(filters.assigneeIds, m.userId, on),
                })
              }
            >
              <UserAvatar image={m.image} name={m.name} size={18} />
              <span className="truncate">{m.name}</span>
            </MenuCheckboxItem>
          ))}
        </FilterMenu>

        <FilterMenu
          count={filters.due === "any" ? 0 : 1}
          hideCount
          icon={<CalendarClockIcon aria-hidden="true" />}
          label={filters.due === "any" ? "Due" : DUE_LABEL[filters.due]}
        >
          <MenuGroup>
            <MenuGroupLabel>Due date</MenuGroupLabel>
            <MenuRadioGroup
              onValueChange={(due: DueFilter) => onChange({ ...filters, due })}
              value={filters.due}
            >
              {(Object.keys(DUE_LABEL) as DueFilter[]).map((d) => (
                <MenuRadioItem key={d} value={d}>
                  {DUE_LABEL[d]}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuGroup>
        </FilterMenu>

        {active ? (
          <>
            <span className="text-muted-foreground px-1 text-xs tabular-nums">
              {hidden > 0 ? `${hidden} hidden` : "Showing all"}
            </span>
            <Button
              onClick={() => onChange(EMPTY_FILTERS)}
              size="sm"
              variant="ghost"
            >
              Clear
            </Button>
          </>
        ) : null}
      </div>

      <div className="ms-auto flex items-center gap-1">
        {updateCount > 0 || filters.updated ? (
          <Tip label="Tasks with activity since your last visit">
            <Button
              aria-pressed={filters.updated}
              className={cn(
                filters.updated && "border-info/32 bg-info/8 dark:bg-info/16",
              )}
              onClick={() =>
                onChange({ ...filters, updated: !filters.updated })
              }
              size="sm"
              variant="outline"
            >
              <BellDotIcon aria-hidden="true" />
              <span className="max-md:hidden">Updates</span>
              {updateCount > 0 ? (
                <Badge className="tabular-nums" size="sm" variant="info">
                  {updateCount}
                </Badge>
              ) : null}
            </Button>
          </Tip>
        ) : null}
        {updateCount > 0 ? (
          <Tip label="Mark all as seen">
            <Button
              aria-label="Mark all as seen"
              onClick={onMarkAllSeen}
              size="icon-sm"
              variant="ghost"
            >
              <CheckCheckIcon aria-hidden="true" />
            </Button>
          </Tip>
        ) : null}
        <Tip label="Weekly digest">
          <Button
            aria-label="Weekly digest"
            onClick={onOpenDigest}
            size="sm"
            variant="ghost"
          >
            <SparklesIcon aria-hidden="true" />
            <span className="max-md:hidden">Digest</span>
          </Button>
        </Tip>
        {archivedCount > 0 ? (
          <Tip label="Archived tasks">
            <Button
              aria-label={`Archived tasks (${archivedCount})`}
              onClick={onOpenArchive}
              size="sm"
              variant="ghost"
            >
              <ArchiveIcon aria-hidden="true" />
              <span className="max-md:hidden">Archive</span>
              <Badge className="tabular-nums" size="sm" variant="secondary">
                {archivedCount}
              </Badge>
            </Button>
          </Tip>
        ) : null}
      </div>
    </div>
  );
});

function FilterMenu({
  icon,
  label,
  count,
  hideCount,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  /** label already names the active value */
  hideCount?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        render={
          <Button
            className={cn(
              count > 0 && "border-info/32 bg-info/8 dark:bg-info/16",
            )}
            size="sm"
            variant="outline"
          />
        }
      >
        {icon}
        {label}
        {count > 0 && !hideCount ? (
          <Badge className="tabular-nums" size="sm" variant="info">
            {count}
          </Badge>
        ) : null}
      </MenuTrigger>
      <MenuPopup
        align="start"
        // cap the inner scroller; max-h on popup lets long label lists spill out
        className="min-w-48 *:max-h-[min(20rem,var(--available-height))]"
      >
        {children}
      </MenuPopup>
    </Menu>
  );
}
