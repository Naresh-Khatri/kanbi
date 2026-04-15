"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.List
		className={cn(
			"inline-flex h-9 items-center justify-start gap-1 rounded-lg bg-white/5 p-1 text-white/70",
			className,
		)}
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
			"inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 font-medium text-sm transition-colors data-[state=active]:bg-white data-[state=active]:text-black",
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
