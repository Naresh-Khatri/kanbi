"use client";

import { CheckIcon, CircleDashedIcon, FlagIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/components/ui/command";
import { MilestoneTarget } from "./milestone-target";

type Entry = {
  id: string | null;
  label: string;
  targetAt: Date | null;
};

/** shared by `m`, ⌘K and the bulk bar */
export function MoveToMilestoneDialog({
  open,
  onOpenChange,
  milestones,
  current,
  count,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** open milestones, board order */
  milestones: { id: string; name: string; targetAt: Date | null }[];
  /** undefined = mixed selection, no checkmark */
  current: string | null | undefined;
  count: number;
  onSelect: (milestoneId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const items = useMemo<Entry[]>(
    () => [
      { id: null, label: "No milestone", targetAt: null },
      ...milestones.map((m) => ({
        id: m.id,
        label: m.name,
        targetAt: m.targetAt,
      })),
    ],
    [milestones],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <CommandDialog onOpenChange={onOpenChange} open={open}>
      <CommandDialogPopup aria-label="Move to milestone">
        <Command
          filteredItems={filtered}
          items={items}
          itemToStringValue={(item) => (item as Entry).label}
          mode="none"
          onValueChange={setQuery}
          value={query}
        >
          <CommandInput
            placeholder={
              count > 1
                ? `Move ${count} tasks to milestone…`
                : "Move to milestone…"
            }
          />
          <CommandPanel>
            <CommandEmpty>No milestones found.</CommandEmpty>
            <CommandList>
              {(item: Entry) => (
                <CommandItem
                  className="[&_svg]:text-muted-foreground gap-2.5 [&_svg]:size-4 [&_svg]:shrink-0"
                  key={item.id ?? "none"}
                  onClick={() => {
                    onOpenChange(false);
                    if (item.id !== current) onSelect(item.id);
                  }}
                  value={item}
                >
                  {item.id ? (
                    <FlagIcon aria-hidden="true" />
                  ) : (
                    <CircleDashedIcon aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <MilestoneTarget
                    className="text-xs"
                    targetAt={item.targetAt}
                  />
                  {item.id === current ? (
                    <CheckIcon aria-hidden="true" />
                  ) : null}
                </CommandItem>
              )}
            </CommandList>
          </CommandPanel>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
