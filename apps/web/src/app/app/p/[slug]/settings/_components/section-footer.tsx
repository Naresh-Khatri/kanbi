import type { ReactNode } from "react";

import { CardFooter } from "@/components/ui/card";

// cal.com-style action bar: hint left, action right
export function SectionFooter({
  hint,
  children,
}: {
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CardFooter className="bg-muted/72 justify-between gap-4 rounded-b-[calc(var(--radius-2xl)-1px)] border-t py-4">
      <p className="text-muted-foreground text-xs">{hint}</p>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </CardFooter>
  );
}
