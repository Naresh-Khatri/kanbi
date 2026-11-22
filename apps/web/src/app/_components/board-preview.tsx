import { PlusIcon } from "lucide-react";
import type React from "react";

import {
  type Priority,
  PriorityIcon,
} from "@/app/app/p/[slug]/_components/priority";
import { AgentLogo } from "@/components/agent-logo";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Frame, FrameHeader, FramePanel } from "@/components/ui/frame";
import { Kbd } from "@/components/ui/kbd";
import { type AgentId, agentMeta } from "@/lib/agents";
import { DEFAULT_LABELS } from "@/lib/palette";
import { cn } from "@/lib/utils";

type Label = (typeof DEFAULT_LABELS)[number]["name"];
type FakeCard = {
  id: string;
  title: string;
  priority: Priority;
  label?: Label;
  initials?: string;
  agent?: AgentId;
};

const LABEL_COLOR = Object.fromEntries(
  DEFAULT_LABELS.map((l) => [l.name, l.color]),
) as Record<Label, string>;

const COLUMNS: { name: string; cards: FakeCard[]; className?: string }[] = [
  {
    name: "Backlog",
    className: "max-lg:hidden",
    cards: [
      {
        id: "KB-17",
        title: "Dark mode for emails",
        priority: "none",
        label: "Design",
      },
    ],
  },
  {
    name: "Todo",
    cards: [
      {
        id: "KB-14",
        title: "Export board as CSV",
        priority: "low",
        label: "Feature",
      },
      {
        id: "KB-18",
        title: "Due date reminders",
        priority: "medium",
        label: "Improvement",
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
        title: "Retry failed webhooks",
        priority: "medium",
        label: "Improvement",
        initials: "GH",
        agent: "claude-code",
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
    className: "max-sm:hidden",
    cards: [
      {
        id: "KB-3",
        title: "Set up projects",
        priority: "medium",
        initials: "AL",
      },
      {
        id: "KB-6",
        title: "Add task labels",
        priority: "low",
        label: "Design",
      },
    ],
  },
];

/** decorative only: static fake data, hidden from assistive tech */
export function BoardPreview() {
  return (
    <Frame
      aria-hidden="true"
      className="w-full max-w-4xl text-left select-none"
    >
      <FrameHeader className="flex-row items-center gap-2 px-4 py-2.5">
        <span className="bg-project-default flex size-5 items-center justify-center rounded-md text-white">
          <Logo className="size-3.5" />
        </span>
        <span className="text-sm font-medium">Kanbi</span>
        <span className="text-muted-foreground text-sm">/ Board</span>
        <span className="text-muted-foreground ms-auto hidden items-center gap-1.5 text-xs sm:flex">
          New task <Kbd>C</Kbd>
        </span>
      </FrameHeader>
      <FramePanel className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 sm:gap-3 sm:p-3 lg:grid-cols-4">
        {COLUMNS.map((col) => (
          <div
            // fewer cols on narrow screens so titles fit
            className={cn("flex min-w-0 flex-col gap-2", col.className)}
            key={col.name}
          >
            <div className="flex items-center gap-2 px-1 py-0.5 text-xs font-medium">
              {col.name}
              <span className="text-muted-foreground tabular-nums">
                {col.cards.length}
              </span>
              <PlusIcon
                aria-hidden="true"
                className="text-muted-foreground ms-auto size-3.5"
              />
            </div>
            {col.cards.map((c) => (
              <div
                className="bg-card flex flex-col gap-2 rounded-lg border p-2.5 shadow-xs/5"
                key={c.id}
              >
                <span className="line-clamp-2 text-xs leading-snug">
                  {c.title}
                </span>
                {c.agent ? <AgentWorking agent={c.agent} /> : null}
                <span className="text-muted-foreground flex items-center gap-1.5 text-[0.6875rem]">
                  <PriorityIcon
                    className="size-3.5 shrink-0"
                    priority={c.priority}
                  />
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
                    <span className="bg-muted text-foreground ms-auto flex size-4 items-center justify-center rounded-full text-[0.5rem] font-medium">
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

function AgentWorking({ agent }: { agent: AgentId }) {
  const { label, color } = agentMeta(agent);
  return (
    <span
      className="text-foreground flex w-fit items-center gap-1.5 rounded-full border border-(--agent)/30 bg-(--agent)/10 px-1.5 py-0.5 text-[0.6875rem]"
      style={{ "--agent": color } as React.CSSProperties}
    >
      <AgentLogo agent={agent} />
      {label} is working
      <span className="size-1.5 animate-pulse rounded-full bg-(--agent) motion-reduce:animate-none" />
    </span>
  );
}
