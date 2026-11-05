import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "text-2xs inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 tracking-wide whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-white/10 text-white/70",
        info: "border-info/40 text-info",
        success: "border-success/40 text-success",
        warning: "border-warning/40 text-warning",
        danger: "border-danger/40 text-danger",
        ai: "border-ai/40 text-ai",
        // emphatic marker on a card edge ("last used")
        inverse: "border-transparent bg-white font-medium text-black",
        // data colour (label/priority) supplied via `color`
        custom: "",
      },
      fill: { outline: "", solid: "border-transparent" },
    },
    compoundVariants: [
      { fill: "solid", tone: "neutral", class: "bg-white/10 text-white" },
      { fill: "solid", tone: "info", class: "bg-info/15" },
      { fill: "solid", tone: "success", class: "bg-success/15" },
      { fill: "solid", tone: "warning", class: "bg-warning/15" },
      { fill: "solid", tone: "danger", class: "bg-danger/15" },
      { fill: "solid", tone: "ai", class: "bg-ai/15" },
      // data colour bg -> dark text
      { fill: "solid", tone: "custom", class: "text-black" },
    ],
    defaultVariants: { tone: "neutral", fill: "outline" },
  },
);

export interface BadgeProps
  extends
    Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof badgeVariants> {
  /** hex data colour; implies tone="custom" */
  color?: string | null;
}

export function Badge({
  className,
  tone,
  fill,
  color,
  style,
  ...props
}: BadgeProps) {
  const custom = color
    ? fill === "solid"
      ? { backgroundColor: color }
      : { borderColor: `${color}55`, color }
    : undefined;
  return (
    <span
      className={cn(
        badgeVariants({ tone: color ? "custom" : tone, fill }),
        className,
      )}
      style={{ ...custom, ...style }}
      {...props}
    />
  );
}

const countVariants = cva("text-2xs rounded px-1 tabular-nums", {
  variants: {
    tone: {
      neutral: "bg-white/10 text-white/70",
      info: "bg-info/15 text-info",
      danger: "bg-danger-solid text-white",
      // drag overlay multi-count
      "info-solid": "bg-info text-black",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function CountBadge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof countVariants>) {
  return <span className={cn(countVariants({ tone }), className)} {...props} />;
}

const dotVariants = cva("inline-block shrink-0 rounded-full", {
  variants: {
    size: {
      xs: "h-1.5 w-1.5",
      sm: "h-2 w-2",
      md: "h-2.5 w-2.5",
      lg: "h-3 w-3",
    },
  },
  defaultVariants: { size: "sm" },
});

export function Dot({
  className,
  size,
  color,
  style,
  ...props
}: Omit<React.HTMLAttributes<HTMLSpanElement>, "color"> &
  VariantProps<typeof dotVariants> & { color?: string | null }) {
  return (
    <span
      aria-hidden
      className={cn(dotVariants({ size }), className)}
      style={{ backgroundColor: color ?? undefined, ...style }}
      {...props}
    />
  );
}
