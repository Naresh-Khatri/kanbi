import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// native select; bg-raised so the OS option list stays dark
const selectVariants = cva(
  "bg-raised rounded-md border border-white/15 text-white focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: { default: "h-9 px-2 text-sm", sm: "h-8 px-2 text-xs" },
    },
    defaultVariants: { size: "default" },
  },
);

export const Select = React.forwardRef<
  HTMLSelectElement,
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> &
    VariantProps<typeof selectVariants>
>(({ className, size, ...props }, ref) => (
  <select
    className={cn(selectVariants({ size }), className)}
    ref={ref}
    {...props}
  />
));
Select.displayName = "Select";
