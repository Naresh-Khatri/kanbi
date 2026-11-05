import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const fieldVariants = cva(
  "flex w-full text-sm text-white placeholder:text-white/40 read-only:cursor-not-allowed read-only:text-white/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "rounded-md border border-white/15 bg-white/5 focus-visible:ring-2 focus-visible:ring-white/30",
        // inline title/name editing: no chrome
        bare: "border-0 bg-transparent p-0",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type FieldProps = VariantProps<typeof fieldVariants>;

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & FieldProps
>(({ className, type, variant, ...props }, ref) => (
  <input
    className={cn(
      fieldVariants({ variant }),
      variant !== "bare" && "h-9 px-3 py-1",
      className,
    )}
    ref={ref}
    type={type}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(({ className, variant, ...props }, ref) => (
  <textarea
    className={cn(
      fieldVariants({ variant }),
      variant !== "bare" && "min-h-20 px-3 py-2",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";
