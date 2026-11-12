"use client";

import type { ReactNode } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type SwatchOption = {
  value: string;
  label: string;
  /** css color; omit for a "none" swatch rendered from `children` */
  color?: string;
  children?: ReactNode;
};

// single-select ToggleGroup; data colors come from db so they're inline style
export function ColorSwatchGroup({
  options,
  value,
  onValueChange,
  disabled,
  className,
  itemClassName,
  "aria-label": ariaLabel,
}: {
  options: readonly SwatchOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
  "aria-label": string;
}) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      className={cn("flex-wrap gap-2", className)}
      disabled={disabled}
      onValueChange={(next) => {
        // ignore deselect: a color is always picked
        const v = next[0] as string | undefined;
        if (v) onValueChange(v);
      }}
      value={[value]}
    >
      {options.map((o) => (
        <ToggleGroupItem
          aria-label={o.label}
          className={cn(
            "border-input data-pressed:ring-foreground/70 data-pressed:ring-offset-background size-7 min-w-0 rounded-full p-0 data-pressed:ring-2 data-pressed:ring-offset-2 sm:size-7 sm:min-w-0",
            itemClassName,
          )}
          key={o.value}
          style={o.color ? { backgroundColor: o.color } : undefined}
          value={o.value}
        >
          {o.children}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
