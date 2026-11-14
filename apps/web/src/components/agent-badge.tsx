"use client";

import type React from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { agentMeta } from "@/lib/agents";
import { cn } from "@/lib/utils";

/** Marks something an MCP agent did on a person's behalf. */
export function AgentBadge({
  agent,
  tooltip,
  className,
}: {
  agent: string;
  tooltip: React.ReactNode;
  className?: string;
}) {
  const { id, label, color, mono } = agentMeta(agent);
  const src = `url(/agents/${id}.svg)`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "text-foreground inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-(--agent)/30 bg-(--agent)/10 px-1.5 text-xs font-medium",
              className,
            )}
            style={{ "--agent": color } as React.CSSProperties}
          />
        }
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0 bg-contain bg-center bg-no-repeat",
            // single-color svgs take the agent color via mask
            mono && "bg-(--agent) mask-contain mask-center mask-no-repeat",
          )}
          style={mono ? { maskImage: src } : { backgroundImage: src }}
        />
        {label}
      </TooltipTrigger>
      <TooltipPopup>{tooltip}</TooltipPopup>
    </Tooltip>
  );
}
