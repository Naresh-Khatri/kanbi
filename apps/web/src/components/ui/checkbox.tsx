import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const boxVariants = cva(
  "flex size-4 shrink-0 items-center justify-center rounded-md border transition",
  {
    variants: {
      tone: {
        neutral: "",
        // multi-select on board (cards, filters)
        info: "",
      },
      checked: { true: "", false: "border-white/20" },
      // opaque backing when overlaying content
      lifted: { true: "bg-raised" },
    },
    compoundVariants: [
      {
        tone: "neutral",
        checked: true,
        class: "border-white bg-white text-black",
      },
      {
        tone: "info",
        checked: true,
        class: "border-info bg-info/15 text-info",
      },
    ],
    defaultVariants: { tone: "neutral", checked: false },
  },
);

type BoxProps = VariantProps<typeof boxVariants>;

/** visual box only; for use inside menu items / rows that own the interaction */
export function CheckboxBox({
  checked,
  tone,
  className,
}: BoxProps & { className?: string }) {
  return (
    <span aria-hidden className={cn(boxVariants({ checked, tone }), className)}>
      {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </span>
  );
}

export const Checkbox = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> &
    Omit<BoxProps, "checked"> & {
      checked: boolean;
      onCheckedChange: (checked: boolean) => void;
    }
>(
  (
    { checked, onCheckedChange, tone, lifted, className, onClick, ...props },
    ref,
  ) => (
    <button
      aria-checked={checked}
      className={cn(
        boxVariants({ checked, tone, lifted }),
        "hover:border-white/40 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none disabled:opacity-50",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onCheckedChange(!checked);
      }}
      ref={ref}
      role="checkbox"
      type="button"
      {...props}
    >
      {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </button>
  ),
);
Checkbox.displayName = "Checkbox";
