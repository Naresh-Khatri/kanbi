"use client";

import type * as React from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";

/** tooltip (+ optional shortcut) around an icon button; button keeps its own aria-label */
export function Tip({
  label,
  keys,
  side,
  children,
}: {
  label: React.ReactNode;
  keys?: string[];
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup className="flex items-center gap-2" side={side}>
        {label}
        {keys?.length ? (
          <KbdGroup>
            {keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </KbdGroup>
        ) : null}
      </TooltipPopup>
    </Tooltip>
  );
}
