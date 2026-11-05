import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const cardVariants = cva("border", {
  variants: {
    tone: {
      // flat panel on canvas
      flat: "border-white/10 bg-white/[0.02]",
      raised: "bg-raised border-white/10",
      // inline info box, skeletons
      muted: "border-white/10 bg-white/5",
      // callouts: colour = meaning
      info: "border-info/20 bg-info/5",
      success: "border-success/20 bg-success/5",
      warning: "border-warning/20 bg-warning/5",
      danger: "border-danger/20 bg-danger/5",
    },
    padding: { none: "", sm: "p-3", md: "p-4", lg: "p-6" },
    // md = blocks nested inside a card/sheet
    radius: { lg: "rounded-lg", md: "rounded-md" },
    interactive: { true: "transition hover:border-white/20 hover:bg-white/10" },
  },
  defaultVariants: { tone: "flat", padding: "md", radius: "lg" },
});

export function Card({
  className,
  tone,
  padding,
  radius,
  interactive,
  as: Comp = "div",
  ...props
}: React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof cardVariants> & { as?: React.ElementType }) {
  return (
    <Comp
      className={cn(
        cardVariants({ tone, padding, radius, interactive }),
        className,
      )}
      {...props}
    />
  );
}

const emptyVariants = cva(
  "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 text-center text-white/40",
  {
    variants: {
      size: {
        sm: "min-h-24 px-3 text-xs",
        md: "p-8 text-sm",
        lg: "p-10 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export function EmptyState({
  className,
  size,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof emptyVariants>) {
  return <div className={cn(emptyVariants({ size }), className)} {...props} />;
}

/** uppercase micro heading for groups in menus, palettes, sidebars */
export function SectionLabel({
  className,
  as: Comp = "p",
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  tone?: "neutral" | "success";
}) {
  return (
    <Comp
      className={cn(
        "text-2xs font-medium tracking-wide uppercase",
        tone === "success" ? "text-success" : "text-white/40",
        className,
      )}
      {...props}
    />
  );
}

const iconTileVariants = cva(
  "flex shrink-0 items-center justify-center border border-white/10 bg-white/5 text-white/70",
  {
    variants: {
      size: { sm: "size-8", md: "size-10", lg: "size-14" },
      shape: { square: "rounded-md", round: "rounded-full" },
    },
    defaultVariants: { size: "md", shape: "square" },
  },
);

/** framed icon: app/client logos, empty-state glyphs */
export function IconTile({
  className,
  size,
  shape,
  ...props
}: React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof iconTileVariants>) {
  return (
    <div
      className={cn(iconTileVariants({ size, shape }), className)}
      {...props}
    />
  );
}

/** in-app page h1 */
export function PageTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn("text-2xl font-semibold", className)} {...props} />;
}

export { cardVariants, emptyVariants };
