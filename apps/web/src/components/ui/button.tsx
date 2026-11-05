"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // /90 = primary hover exception (ledger)
        default: "bg-white text-black hover:bg-white/90",
        secondary: "bg-white/10 text-white hover:bg-white/15",
        outline:
          "border border-white/15 bg-transparent text-white hover:bg-white/10",
        ghost: "text-white hover:bg-white/10",
        // icon/toolbar affordance: muted until hover
        quiet: "text-white/40 hover:bg-white/5 hover:text-white",
        dashed:
          "rounded-lg border border-dashed border-white/10 font-normal text-white/40 hover:border-white/20 hover:bg-white/5 hover:text-white",
        "quiet-danger": "hover:text-danger text-white/40 hover:bg-white/5",
        // linear-style property trigger (priority, assignee, due…)
        property:
          "font-normal text-white/70 hover:bg-white/5 hover:text-white focus-visible:bg-white/5 data-[state=open]:bg-white/5",
        link: "font-normal text-white/40 hover:text-white/70",
        ai: "border-ai/20 bg-ai/10 text-ai hover:bg-ai/15 border",
        // toolbar chips (filters, sort): outline at body weight
        toolbar:
          "border border-white/15 bg-transparent font-normal text-white/70 hover:bg-white/10 hover:text-white",
        // active filter / applied state
        selected:
          "border-info/40 bg-info/10 text-info hover:bg-info/15 border font-normal",
        "selected-warning":
          "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15 border font-normal",
        destructive: "bg-danger-solid hover:bg-danger-solid/70 text-white",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        // property rows at body size (task sheet)
        md: "h-8 rounded-md px-2 text-sm",
        xs: "h-7 rounded-md px-2 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
        "icon-md": "h-8 w-8",
        "icon-sm": "h-7 w-7",
        "icon-xs": "h-6 w-6",
        inline: "h-auto p-0 text-xs",
      },
      // marketing CTAs only
      shape: { default: "", pill: "rounded-full" },
    },
    defaultVariants: { variant: "default", size: "default", shape: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, shape }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
