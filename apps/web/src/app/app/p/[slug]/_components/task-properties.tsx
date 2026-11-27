"use client";

import { formatDate } from "@kanbi/shared";
import {
  CalendarDaysIcon,
  PlusIcon,
  TagIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectPrimitive,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { RouterOutputs } from "@/trpc/react";
import {
  PRIORITIES,
  PRIORITY_META,
  type Priority,
  PriorityIcon,
} from "./priority";

type Members = RouterOutputs["project"]["members"];
export type LabelOption = { id: string; name: string; color: string };

// chip = outline xs chips in dialogs; row = ghost property rows in the detail drawer
export type PropertySize = "chip" | "row";

// parse as local date so YYYY-MM-DD isn't shifted by timezone
export function formatDueDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return formatDate(new Date(y, m - 1, d));
}

function parseIsoDate(iso: string | null) {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toIsoDate(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function PropertyButton({
  size = "row",
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "variant"> & {
  size?: PropertySize;
}) {
  return size === "row" ? (
    <Button
      className={cn("max-w-full justify-start", className)}
      size="sm"
      variant="ghost"
      {...props}
    />
  ) : (
    <Button className={className} size="xs" variant="outline" {...props} />
  );
}

export function propertyButton(size: PropertySize) {
  return <PropertyButton size={size} />;
}

export function PropertyText({
  placeholder,
  children,
}: {
  placeholder?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("truncate", placeholder && "text-muted-foreground")}>
      {children}
    </span>
  );
}

export function LabelSwatch({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}

const PRIORITY_ITEMS = PRIORITIES.map((p) => ({
  value: p,
  label: PRIORITY_META[p].label,
}));

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
    <Select
      disabled={disabled}
      items={PRIORITY_ITEMS}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
      value={value}
    >
      <SelectPrimitive.Trigger
        aria-label="Priority"
        render={propertyButton(size)}
      >
        <PriorityIcon priority={value} />
        <PropertyText placeholder={value === "none"}>
          {value === "none"
            ? size === "row"
              ? "None"
              : "Priority"
            : PRIORITY_META[value].label}
        </PropertyText>
      </SelectPrimitive.Trigger>
      <SelectPopup alignItemWithTrigger={false}>
        {PRIORITY_ITEMS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            <span className="flex items-center gap-2">
              <PriorityIcon className="size-4" priority={p.value} />
              {p.label}
            </span>
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

type AssigneeOption = {
  key: string;
  id: string | null;
  label: string;
  image?: string | null;
};

const UNASSIGNED: AssigneeOption = {
  key: "none",
  id: null,
  label: "Unassigned",
};

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
  // "Assign to me" option, and trigger reads "You" when self is assignee
  selfId?: string | null;
}) {
  const current = members.find((m) => m.userId === value);
  const options = useMemo<AssigneeOption[]>(() => {
    const list: AssigneeOption[] = [];
    if (selfId && value !== selfId) {
      list.push({ key: "self", id: selfId, label: "Assign to me" });
    }
    list.push(UNASSIGNED);
    for (const m of members) {
      list.push({ key: m.userId, id: m.userId, label: m.name, image: m.image });
    }
    return list;
  }, [members, selfId, value]);
  const selected =
    options.find((o) => o.key !== "self" && o.id === value) ?? null;
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <Combobox
      autoHighlight
      disabled={disabled}
      isItemEqualToValue={(a, b) => a.key === b.key}
      itemToStringLabel={(o) => o.label}
      items={options}
      onValueChange={(o) => {
        if (o) onChange(o.id);
      }}
      value={selected}
    >
      <ComboboxTrigger
        aria-label="Assignee"
        ref={anchorRef}
        render={propertyButton(size)}
      >
        {current ? (
          <UserAvatar
            image={current.image}
            name={current.name}
            size={size === "row" ? 20 : 16}
          />
        ) : (
          <UserIcon aria-hidden="true" />
        )}
        <PropertyText placeholder={!current}>
          {current
            ? current.userId === selfId
              ? "You"
              : current.name
            : size === "row"
              ? "Unassigned"
              : "Assignee"}
        </PropertyText>
      </ComboboxTrigger>
      {/* coss popup defaults anchor to chipsRef (null w/o chips) -> pin to trigger */}
      <ComboboxPopup anchor={anchorRef} className="w-60">
        <PopupSearch placeholder="Assign to…" />
        <ComboboxEmpty>No one found.</ComboboxEmpty>
        <ComboboxList>
          {(o: AssigneeOption) => (
            <ComboboxItem key={o.key} value={o}>
              <span className="flex items-center gap-2">
                {o.key === "self" || o.id === null ? (
                  <UserIcon
                    aria-hidden="true"
                    className="text-muted-foreground"
                  />
                ) : (
                  <UserAvatar image={o.image} name={o.label} size={18} />
                )}
                <span className="truncate">{o.label}</span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}

function PopupSearch({ placeholder }: { placeholder: string }) {
  return (
    <div className="border-b p-1">
      <ComboboxInput
        className="rounded-md border-transparent bg-transparent shadow-none ring-0 before:hidden dark:bg-transparent"
        placeholder={placeholder}
        showTrigger={false}
        size="sm"
      />
    </div>
  );
}

const CREATE_KEY = "__create__";

// multi-select labels; onCreate enables "Create “q”" for unmatched queries
export function LabelsCombobox({
  labels,
  selected,
  onToggle,
  onCreate,
  trigger,
  footer,
  disabled,
  emptyText = "No labels yet.",
  open,
  onOpenChange,
}: {
  labels: LabelOption[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onCreate?: (name: string) => void;
  trigger: React.ReactElement;
  footer?: React.ReactNode;
  disabled?: boolean;
  emptyText?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const canCreate =
    !!onCreate &&
    q.length > 0 &&
    !labels.some((l) => l.name.toLowerCase() === q.toLowerCase());
  const items = useMemo<LabelOption[]>(
    () =>
      canCreate
        ? [...labels, { id: CREATE_KEY, name: `Create “${q}”`, color: "" }]
        : labels,
    [labels, canCreate, q],
  );
  const value = labels.filter((l) => selected.has(l.id));
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <Combobox
      autoHighlight
      disabled={disabled}
      inputValue={query}
      isItemEqualToValue={(a, b) => a.id === b.id}
      itemToStringLabel={(l) => l.name}
      items={items}
      multiple
      onInputValueChange={setQuery}
      onOpenChange={onOpenChange}
      open={open}
      onValueChange={(next) => {
        if (next.some((l) => l.id === CREATE_KEY)) {
          onCreate?.(q);
          setQuery("");
          return;
        }
        const nextIds = new Set(next.map((l) => l.id));
        for (const l of labels) {
          const was = selected.has(l.id);
          const now = nextIds.has(l.id);
          if (was !== now) onToggle(l.id, now);
        }
      }}
      value={value}
    >
      <ComboboxTrigger aria-label="Labels" ref={anchorRef} render={trigger} />
      <ComboboxPopup anchor={anchorRef} className="w-60">
        <PopupSearch
          placeholder={onCreate ? "Search or create…" : "Search labels…"}
        />
        <ComboboxEmpty>{q ? "No matching labels." : emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(l: LabelOption) => (
            <ComboboxItem key={l.id} value={l}>
              <span className="flex items-center gap-2">
                {l.id === CREATE_KEY ? (
                  <PlusIcon
                    aria-hidden="true"
                    className="text-muted-foreground"
                  />
                ) : (
                  <LabelSwatch color={l.color} />
                )}
                <span className="truncate">{l.name}</span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
        {footer ? <div className="border-t p-1">{footer}</div> : null}
      </ComboboxPopup>
    </Combobox>
  );
}

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
  const active = labels.filter((l) => selected.has(l.id));
  return (
    <LabelsCombobox
      emptyText={emptyText}
      labels={labels}
      onToggle={onToggle}
      selected={selected}
      trigger={
        <Button size="xs" variant="outline">
          {active.length > 0 ? (
            <span className="flex items-center -space-x-0.5">
              {active.slice(0, 3).map((l) => (
                <LabelSwatch
                  className="ring-popover ring-2"
                  color={l.color}
                  key={l.id}
                />
              ))}
            </span>
          ) : (
            <TagIcon aria-hidden="true" />
          )}
          {active.length === 1
            ? active[0]!.name
            : active.length > 1
              ? `${active.length} labels`
              : "Labels"}
        </Button>
      }
    />
  );
}

export function DueDatePicker({
  value,
  label,
  onChange,
  size = "chip",
  disabled,
  defaultOpen = false,
}: {
  // YYYY-MM-DD
  value: string | null;
  defaultOpen?: boolean;
  // display override when the shown date isn't derived from `value`
  label?: string;
  onChange: (value: string | null) => void;
  size?: PropertySize;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const selected = parseIsoDate(value);
  const row = size === "row";

  return (
    <span className="inline-flex min-w-0 items-center gap-0.5">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          aria-label="Due date"
          disabled={disabled}
          render={propertyButton(size)}
        >
          <CalendarDaysIcon aria-hidden="true" />
          <PropertyText placeholder={!value}>
            {value
              ? (label ?? formatDueDate(value))
              : row
                ? "No date"
                : "Due date"}
          </PropertyText>
        </PopoverTrigger>
        <PopoverPopup align="start">
          <Calendar
            autoFocus
            defaultMonth={selected}
            mode="single"
            onSelect={(d: Date | undefined) => {
              onChange(d ? toIsoDate(d) : null);
              setOpen(false);
            }}
            selected={selected}
          />
        </PopoverPopup>
      </Popover>
      {value && !disabled ? (
        <Button
          aria-label="Clear due date"
          onClick={() => onChange(null)}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <XIcon aria-hidden="true" />
        </Button>
      ) : null}
    </span>
  );
}
