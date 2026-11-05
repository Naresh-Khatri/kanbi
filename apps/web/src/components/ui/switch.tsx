import * as React from "react";

import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }
>(({ checked, onCheckedChange, className, ...props }, ref) => (
  <button
    aria-checked={checked}
    className={cn(
      "relative h-5 w-9 shrink-0 rounded-full transition focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none disabled:opacity-50",
      checked ? "bg-white" : "bg-white/15",
      className,
    )}
    onClick={() => onCheckedChange(!checked)}
    ref={ref}
    role="switch"
    type="button"
    {...props}
  >
    <span
      className={cn(
        "absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition-all",
        checked ? "translate-x-4 bg-black" : "bg-white/70",
      )}
    />
  </button>
));
Switch.displayName = "Switch";
