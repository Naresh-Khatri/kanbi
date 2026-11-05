"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const segmentBase = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md whitespace-nowrap text-white/40 transition hover:bg-white/5 hover:text-white/70 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      size: {
        "2xs": "text-2xs h-auto px-1.5 py-0.5",
        xs: "h-7 px-2 text-xs",
        sm: "h-8 px-2.5 text-xs",
      },
      tone: {
        quiet: "",
        nav: "text-white/70 hover:text-white",
      },
      active: {
        true: "bg-white/10 text-white hover:bg-white/10 hover:text-white",
      },
    },
    defaultVariants: { size: "sm" },
  },
);

// shared by Radix tabs, segmented buttons and route nav links; merged so active text beats base
export const segmentVariants = ({
  className,
  ...props
}: VariantProps<typeof segmentBase> & { className?: string } = {}) =>
  cn(segmentBase(props), className);

// tray behind segmented buttons
export const segmentGroup =
  "inline-flex w-fit items-center gap-0.5 rounded-lg bg-white/5 p-0.5";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    className={cn("inline-flex items-center justify-start gap-1", className)}
    ref={ref}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    className={cn(
      segmentVariants({ size: "sm" }),
      "data-[state=active]:bg-white/10 data-[state=active]:text-white",
      className,
    )}
    ref={ref}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    className={cn("mt-3", className)}
    ref={ref}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
