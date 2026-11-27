"use client";

import {
  CircleCheckIcon,
  FlagIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { MilestoneTarget } from "@/components/milestone/milestone-target";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  type MilestoneFilter,
  type MilestoneProgress,
  NO_MILESTONE,
} from "@/lib/milestone";
import { cn } from "@/lib/utils";

export type MilestoneOption = {
  id: string;
  name: string;
  status: "upcoming" | "active" | "closed";
  targetAt: Date | null;
  progress: MilestoneProgress;
};

// radio values can't be null
const ALL = "__all__";

export function MilestoneMenu({
  milestones,
  filter,
  onFilterChange,
  canWrite,
  settingsHref,
  onCreate,
  onEdit,
  onClose,
}: {
  /** open milestones only, board order */
  milestones: MilestoneOption[];
  filter: MilestoneFilter;
  onFilterChange: (next: MilestoneFilter) => void;
  canWrite: boolean;
  /** omitted on public boards */
  settingsHref?: string;
  onCreate?: () => void;
  onEdit?: (id: string) => void;
  onClose?: (id: string) => void;
}) {
  const selected = milestones.find((m) => m.id === filter) ?? null;
  const active = milestones.filter((m) => m.status === "active");
  const upcoming = milestones.filter((m) => m.status === "upcoming");
  const label = selected
    ? selected.name
    : filter === NO_MILESTONE
      ? "No milestone"
      : "All tasks";

  const renderItem = (m: MilestoneOption) => (
    <MenuRadioItem closeOnClick key={m.id} value={m.id}>
      <span className="flex w-full items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{m.name}</span>
        <MilestoneTarget className="text-xs" targetAt={m.targetAt} />
        <span className="text-muted-foreground text-xs tabular-nums">
          {m.progress.done}/{m.progress.total}
        </span>
      </span>
    </MenuRadioItem>
  );

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            className={cn(
              "max-w-56",
              filter !== null && "border-info/32 bg-info/8 dark:bg-info/16",
            )}
            size="sm"
            variant="outline"
          />
        }
      >
        <FlagIcon aria-hidden="true" />
        <span className="truncate">{label}</span>
        {selected ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {selected.progress.done}/{selected.progress.total}
          </span>
        ) : null}
      </MenuTrigger>
      <MenuPopup
        align="start"
        // ! beats menu.tsx's always-on min-w-32 variant
        className="min-w-64! *:max-h-[min(24rem,var(--available-height))]"
      >
        <MenuRadioGroup
          onValueChange={(v: string) => onFilterChange(v === ALL ? null : v)}
          value={filter ?? ALL}
        >
          <MenuRadioItem closeOnClick value={ALL}>
            All tasks
          </MenuRadioItem>
          <MenuRadioItem closeOnClick value={NO_MILESTONE}>
            No milestone
          </MenuRadioItem>
          {active.length > 0 ? (
            <>
              <MenuSeparator />
              <MenuGroup>
                <MenuGroupLabel>Active</MenuGroupLabel>
                {active.map(renderItem)}
              </MenuGroup>
            </>
          ) : null}
          {upcoming.length > 0 ? (
            <>
              <MenuSeparator />
              <MenuGroup>
                <MenuGroupLabel>Upcoming</MenuGroupLabel>
                {upcoming.map(renderItem)}
              </MenuGroup>
            </>
          ) : null}
        </MenuRadioGroup>
        {canWrite ? (
          <>
            <MenuSeparator />
            {selected ? (
              <>
                <MenuItem onClick={() => onEdit?.(selected.id)}>
                  <PencilIcon aria-hidden="true" />
                  Edit {selected.name}
                </MenuItem>
                <MenuItem onClick={() => onClose?.(selected.id)}>
                  <CircleCheckIcon aria-hidden="true" />
                  Close {selected.name}…
                </MenuItem>
              </>
            ) : null}
            <MenuItem onClick={onCreate}>
              <PlusIcon aria-hidden="true" />
              New milestone…
            </MenuItem>
          </>
        ) : null}
        {settingsHref ? (
          <>
            {canWrite ? null : <MenuSeparator />}
            <MenuItem render={<Link href={settingsHref} />}>
              <SettingsIcon aria-hidden="true" />
              Manage milestones
            </MenuItem>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
}
