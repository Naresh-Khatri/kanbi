import type React from "react";

import { agentMeta } from "@/lib/agents";
import { cn } from "@/lib/utils";

/** Agent icon from /public/agents; decorative. */
export function AgentLogo({
  agent,
  className,
}: {
  agent: string;
  className?: string;
}) {
  const { id, color, mono } = agentMeta(agent);
  const src = `url(/agents/${id}.svg)`;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-3 shrink-0 bg-contain bg-center bg-no-repeat",
        // single-color svgs take the agent color via mask
        mono && "bg-(--agent) mask-contain mask-center mask-no-repeat",
        className,
      )}
      style={
        (mono
          ? { "--agent": color, maskImage: src }
          : { backgroundImage: src }) as React.CSSProperties
      }
    />
  );
}
