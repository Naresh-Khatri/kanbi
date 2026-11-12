import Link from "next/link";
import type * as React from "react";

import { Wordmark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** centered marketing/auth frame: wordmark on top, content below */
export function AuthShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "relative isolate flex min-h-dvh flex-col items-center gap-8 px-6 pt-20 pb-12 sm:pt-28",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-112 bg-radial-[ellipse_at_50%_0%] from-foreground/6 to-transparent to-70%"
      />
      <Link aria-label="Kanbi home" className="rounded-md" href="/">
        <Wordmark />
      </Link>
      {children}
    </main>
  );
}
