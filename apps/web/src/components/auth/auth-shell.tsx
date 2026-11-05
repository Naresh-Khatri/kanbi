import * as React from "react";

import { cn } from "@/lib/utils";

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
        "bg-marketing flex min-h-screen flex-col items-center px-6 pt-24 pb-12 text-white sm:pt-32",
        className,
      )}
    >
      {children}
    </main>
  );
}
