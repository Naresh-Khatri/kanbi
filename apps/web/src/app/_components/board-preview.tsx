import { PlusIcon } from "lucide-react";

import {
  type Priority,
  PriorityIcon,
} from "@/app/app/p/[slug]/_components/priority";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Frame, FrameHeader, FramePanel } from "@/components/ui/frame";
import { Kbd } from "@/components/ui/kbd";
import { DEFAULT_LABELS } from "@/lib/palette";
import { cn } from "@/lib/utils";

type Label = (typeof DEFAULT_LABELS)[number]["name"];
type FakeCard = {
  id: string;
  title: string;
  priority: Priority;
  label?: Label;
  initials?: string;
};

const LABEL_COLOR = Object.fromEntries(
  DEFAULT_LABELS.map((l) => [l.name, l.color]),
) as Record<Label, string>;

const COLUMNS: { name: string; cards: FakeCard[] }[] = [
  {
    name: "Backlog",
    cards: [
      {
        id: "KB-14",
        title: "Export board as CSV",
        priority: "low",
        label: "Feature",
      },
      {
        id: "KB-17",
        title: "Dark mode for emails",
        priority: "none",
        label: "Design",
      },
    ],
  },
  {
    name: "In progress",
    cards: [
      {
        id: "KB-9",
        title: "Fix drag on touch devices",
        priority: "urgent",
        label: "Bug",
        initials: "AL",
      },
      {
        id: "KB-12",
        title: "Keyboard shortcut help",
        priority: "medium",
        label: "Improvement",
        initials: "GH",
      },
      {
        id: "KB-15",
        title: "Invite teammates",
        priority: "high",
        label: "Feature",
      },
    ],
  },
  {
    name: "Done",
    cards: [
      {
        id: "KB-3",
        title: "Set up projects",
        priority: "medium",
        initials: "AL",
      },
      { id: "KB-6", title: "Add task labels", priority: "low", label: "Design" },
    ],
  },
];

/** decorative only: static fake data, hidden from assistive tech */
export function BoardPreview() {
  return (
    <Frame aria-hidden="true" className="w-full max-w-4xl select-none text-left">
      <FrameHeader className="flex-row items-center gap-2 px-4 py-2.5">
        <span className="flex size-5 items-center justify-center rounded-md bg-project-default text-white">
          <Logo className="size-3.5" />
        </span>
        <span className="font-medium text-sm">Kanbi</span>
        <span className="text-muted-foreground text-sm">/ Board</span>
        <span className="ms-auto hidden items-center gap-1.5 text-muted-foreground text-xs sm:flex">
          New task <Kbd>C</Kbd>
        </span>
      </FrameHeader>
      <FramePanel className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 sm:gap-3 sm:p-3">
        {COLUMNS.map((col, i) => (
          <div
            // 2 cols on phones so titles fit
            className={cn("flex min-w-0 flex-col gap-2", i === 2 && "max-sm:hidden")}
            key={col.name}
          >
            <div className="flex items-center gap-2 px-1 py-0.5 font-medium text-xs">
              {col.name}
              <span className="text-muted-foreground tabular-nums">
                {col.cards.length}
              </span>
              <PlusIcon
                aria-hidden="true"
                className="ms-auto size-3.5 text-muted-foreground"
              />
            </div>
            {col.cards.map((c) => (
              <div
                className="flex flex-col gap-2 rounded-lg border bg-card p-2.5 shadow-xs/5"
                key={c.id}
              >
                <span className="line-clamp-2 text-xs leading-snug">
                  {c.title}
                </span>
                <span className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                  <PriorityIcon className="size-3.5 shrink-0" priority={c.priority} />
                  <span className="tabular-nums">{c.id}</span>
                  {c.label ? (
                    <Badge
                      className="hidden gap-1 sm:inline-flex"
                      size="sm"
                      variant="outline"
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: LABEL_COLOR[c.label] }}
                      />
                      {c.label}
                    </Badge>
                  ) : null}
                  {c.initials ? (
                    <span className="ms-auto flex size-4 items-center justify-center rounded-full bg-muted font-medium text-[0.5rem] text-foreground">
                      {c.initials}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ))}
      </FramePanel>
    </Frame>
  );
}
