"use client";

import { formatDate } from "@kanbi/shared";
import { CalendarDays, Check, Tag, User as UserIcon, X } from "lucide-react";
import { useRef } from "react";
import { Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/trpc/react";
import {
  PRIORITIES,
  PRIORITY_META,
  type Priority,
  PriorityIcon,
} from "./priority";

type Members = RouterOutputs["project"]["members"];
type LabelOption = { id: string; name: string; color: string };

// chip = compact xs chips in dialogs; row = md property rows in the detail sheet
export type PropertySize = "chip" | "row";

const SIZE = {
  chip: {
    button: "xs",
    icon: "h-3.5 w-3.5",
    priorityIcon: "h-3.5 w-3.5",
    triggerAvatar: 16,
    menuAvatar: 20,
  },
  row: {
    button: "md",
    icon: "h-4 w-4 shrink-0 text-white/40",
    priorityIcon: "h-4 w-4 shrink-0",
    triggerAvatar: 20,
    menuAvatar: 18,
  },
} as const;

// parse as local date so YYYY-MM-DD isn't shifted by timezone
export function formatDueDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return formatDate(new Date(y, m - 1, d));
}

function TriggerLabel({
  size,
  placeholder,
  children,
}: {
  size: PropertySize;
  placeholder?: boolean;
  children: React.ReactNode;
}) {
  if (size === "chip") return <>{children}</>;
  return (
    <span className={cn("truncate", placeholder && "text-white/40")}>
      {children}
    </span>
  );
}

function PropertyTrigger({
  size,
  disabled,
  children,
}: {
  size: PropertySize;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        className={size === "row" ? "max-w-full" : undefined}
        disabled={disabled}
        size={SIZE[size].button}
        type="button"
        variant="property"
      >
        {children}
      </Button>
    </DropdownMenuTrigger>
  );
}

function CheckMark() {
  return <Check className="ml-auto h-3.5 w-3.5" />;
}

export function PriorityPicker({
  value,
  onChange,
  size = "chip",
  disabled,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
  size?: PropertySize;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <PropertyTrigger disabled={disabled} size={size}>
        <PriorityIcon className={SIZE[size].priorityIcon} priority={value} />
        <TriggerLabel placeholder={value === "none"} size={size}>
          {value === "none" ? "Priority" : PRIORITY_META[value].label}
        </TriggerLabel>
      </PropertyTrigger>
      <DropdownMenuContent align="start">
        {PRIORITIES.map((p) => (
          <DropdownMenuItem key={p} onSelect={() => onChange(p)}>
            <PriorityIcon className="mr-2 h-3.5 w-3.5" priority={p} />
            {PRIORITY_META[p].label}
            {p === value ? <CheckMark /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AssigneePicker({
  value,
  members,
  onChange,
  size = "chip",
  disabled,
  selfId,
}: {
  value: string | null;
  members: Members;
  onChange: (id: string | null) => void;
  size?: PropertySize;
  disabled?: boolean;
  // shows "Assign to me" when set and not already the assignee
  selfId?: string | null;
}) {
  const current = members.find((m) => m.userId === value);
  const canSelfAssign = !!selfId && value !== selfId;
  const s = SIZE[size];
  return (
    <DropdownMenu>
      <PropertyTrigger disabled={disabled} size={size}>
        {current ? (
          <UserAvatar
            image={current.image}
            name={current.name}
            size={s.triggerAvatar}
          />
        ) : (
          <UserIcon className={s.icon} />
        )}
        <TriggerLabel placeholder={!current} size={size}>
          {current ? current.name : "Assignee"}
        </TriggerLabel>
      </PropertyTrigger>
      <DropdownMenuContent align="start">
        {canSelfAssign ? (
          <>
            <DropdownMenuItem onSelect={() => onChange(selfId)}>
              <UserIcon className="h-3.5 w-3.5" />
              Assign to me
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onSelect={() => onChange(null)}>
          {size === "chip" ? (
            <span className="flex h-5 w-5 items-center justify-center">
              <UserIcon className="h-3.5 w-3.5 text-white/40" />
            </span>
          ) : null}
          Unassigned
          {value === null ? <CheckMark /> : null}
        </DropdownMenuItem>
        {members.map((m) => (
          <DropdownMenuItem key={m.userId} onSelect={() => onChange(m.userId)}>
            <UserAvatar image={m.image} name={m.name} size={s.menuAvatar} />
            {m.name}
            {value === m.userId ? <CheckMark /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// multi-select menu; the sheet has its own search/create picker
export function LabelsChip({
  labels,
  selected,
  onToggle,
  emptyText,
}: {
  labels: LabelOption[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  emptyText: string;
}) {
  return (
    <DropdownMenu>
      <PropertyTrigger size="chip">
        <Tag className={SIZE.chip.icon} />
        Labels
      </PropertyTrigger>
      <DropdownMenuContent align="start">
        {labels.length === 0 ? (
          <DropdownMenuItem disabled>{emptyText}</DropdownMenuItem>
        ) : (
          labels.map((l) => {
            const on = selected.has(l.id);
            return (
              <DropdownMenuItem
                key={l.id}
                onSelect={(e) => {
                  e.preventDefault();
                  onToggle(l.id, !on);
                }}
              >
                <Dot className="mr-2" color={l.color} size="md" />
                {l.name}
                {on ? <CheckMark /> : null}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DueDatePicker({
  value,
  label,
  onChange,
  size = "chip",
  disabled,
}: {
  // YYYY-MM-DD, the native date input value
  value: string | null;
  // display override when the shown date isn't derived from `value`
  label?: string;
  onChange: (value: string | null) => void;
  size?: PropertySize;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const row = size === "row";

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  return (
    <span className="relative inline-flex items-center">
      <Button
        className={row ? "max-w-full" : undefined}
        disabled={disabled}
        onClick={openPicker}
        size={SIZE[size].button}
        type="button"
        variant="property"
      >
        <CalendarDays className={SIZE[size].icon} />
        <TriggerLabel placeholder={!value} size={size}>
          {value ? (label ?? formatDueDate(value)) : "Due date"}
        </TriggerLabel>
      </Button>
      {value && !disabled ? (
        <Button
          aria-label="Clear due date"
          className={row ? "-ml-1" : undefined}
          onClick={() => onChange(null)}
          size="icon-xs"
          type="button"
          variant="quiet"
        >
          <X className="h-3 w-3" />
        </Button>
      ) : null}
      <input
        aria-hidden
        className={cn(
          "pointer-events-none absolute opacity-0",
          row ? "inset-0" : "bottom-0 left-3 h-0 w-0",
        )}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        ref={inputRef}
        tabIndex={-1}
        type="date"
        value={value ?? ""}
      />
    </span>
  );
}
