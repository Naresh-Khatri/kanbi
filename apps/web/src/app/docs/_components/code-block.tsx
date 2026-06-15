"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * A monospace command/config block with a copy button, styled to match the
 * product card idiom (hairline border + faint fill). Used on the public docs
 * pages where setup is copy-paste.
 */
export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="relative rounded-lg border border-white/10 bg-white/5">
      <pre className="overflow-x-auto px-4 py-3 pr-12 font-mono text-sm leading-relaxed text-white/90">
        <code>{code}</code>
      </pre>
      <button
        aria-label="Copy to clipboard"
        className="absolute top-2.5 right-2.5 rounded-md p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
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
      </button>
    </div>
  );
}
