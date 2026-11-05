import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const kbdVariants = cva("rounded font-sans", {
  variants: {
    variant: {
      // inline hint inside buttons/inputs
      hint: "text-2xs border border-white/10 px-1 text-white/40",
      // cheatsheet / palette rows
      key: "bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white/70",
    },
  },
  defaultVariants: { variant: "hint" },
});

export function Kbd({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLElement> & VariantProps<typeof kbdVariants>) {
  return <kbd className={cn(kbdVariants({ variant }), className)} {...props} />;
}
