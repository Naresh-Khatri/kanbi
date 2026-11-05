import * as React from "react";

import { cn } from "@/lib/utils";

/** selectable colour/avatar tile; `color` is db/data colour */
export const Swatch = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    selected: boolean;
    color?: string;
    shape?: "round" | "square";
  }
>(({ selected, color, shape = "round", className, style, ...props }, ref) => (
  <button
    aria-pressed={selected}
    className={cn(
      "flex items-center justify-center overflow-hidden border transition focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      shape === "round" ? "rounded-full" : "rounded-md",
      selected
        ? "border-white ring-2 ring-white/40"
        : "border-white/10 hover:border-white/40",
      className,
    )}
    ref={ref}
    style={color ? { background: color, ...style } : style}
    type="button"
    {...props}
  />
));
Swatch.displayName = "Swatch";
