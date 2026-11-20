"use client";

import { EyeOffIcon } from "lucide-react";
import Link from "next/link";
import type React from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { agentMeta } from "@/lib/agents";
import { cn } from "@/lib/utils";

/** Marks something an MCP agent did on a person's behalf. */
export function AgentBadge({
  agent,
  tooltip,
  hiddenFromTeam = false,
  settingsHref,
  className,
}: {
  agent: string;
  tooltip: React.ReactNode;
  /** disclosure off -> only the owner and whoever ran the agent see this */
  hiddenFromTeam?: boolean;
  /** owner only: eye-off icon links to the disclosure setting */
  settingsHref?: string;
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
        {hiddenFromTeam && settingsHref ? (
          <Link
            aria-label="Hidden from teammates. Open agent disclosure settings"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -m-0.5 rounded-full p-0.5 outline-none focus-visible:ring-2"
            href={settingsHref}
          >
            <EyeOffIcon aria-hidden="true" className="size-3" />
          </Link>
        ) : hiddenFromTeam ? (
          <EyeOffIcon
            aria-label="Hidden from teammates"
            className="text-muted-foreground size-3 shrink-0"
          />
        ) : null}
      </TooltipTrigger>
      <TooltipPopup>
        {hiddenFromTeam ? (
          <span className="flex max-w-64 flex-col gap-1">
            <span>{tooltip}</span>
            <span className="text-muted-foreground">
              Hidden from teammates. Agent disclosure is off, so they see this
              as regular work.
              {settingsHref ? " Click the eye to change it." : null}
            </span>
          </span>
        ) : (
          tooltip
        )}
      </TooltipPopup>
    </Tooltip>
  );
}
