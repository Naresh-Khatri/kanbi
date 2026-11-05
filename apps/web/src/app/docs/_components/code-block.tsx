"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/surface";

/**
 * A monospace command/config block with a copy button, styled to match the
 * product card idiom (hairline border + faint fill). Used on the public docs
 * pages where setup is copy-paste.
 */
export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Card className="relative" padding="none" tone="muted">
      <pre className="overflow-x-auto px-4 py-3 pr-12 font-mono text-sm leading-relaxed text-white">
        <code>{code}</code>
      </pre>
      <Button
        aria-label="Copy to clipboard"
        className="absolute top-2 right-2"
        size="icon-sm"
        variant="quiet"
        onClick={() => {
          void navigator.clipboard.writeText(code);
          setCopied(true);
          toast.success("Copied");
          setTimeout(() => setCopied(false), 1500);
        }}
        type="button"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </Card>
  );
}
