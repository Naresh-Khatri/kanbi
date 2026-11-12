"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";

/** copy-paste command/config block for the public docs */
export function CodeBlock({
  code,
  label = "Terminal",
}: {
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <Frame>
      <FrameHeader className="flex-row items-center justify-between py-1 ps-3 pe-1">
        <FrameTitle className="font-normal text-muted-foreground text-xs">
          {label}
        </FrameTitle>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={copied ? "Copied" : "Copy to clipboard"}
                onClick={() => {
                  void navigator.clipboard.writeText(code);
                  setCopied(true);
                }}
                size="icon-xs"
                type="button"
                variant="ghost"
              />
            }
          >
            {copied ? (
              <CheckIcon aria-hidden="true" className="text-success-foreground" />
            ) : (
              <CopyIcon aria-hidden="true" />
            )}
          </TooltipTrigger>
          <TooltipPopup>{copied ? "Copied" : "Copy"}</TooltipPopup>
        </Tooltip>
      </FrameHeader>
      <FramePanel className="overflow-x-auto p-0">
        <pre className="px-4 py-3 font-mono text-[0.8125rem] text-foreground leading-relaxed">
          <code>{code}</code>
        </pre>
      </FramePanel>
    </Frame>
  );
}
