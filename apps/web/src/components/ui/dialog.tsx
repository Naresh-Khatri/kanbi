"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

// shared with cmdk palette (not radix)
export const scrimVariants = cva("fixed inset-0", {
  variants: {
    tone: {
      dim: "bg-black/70",
      // palette: lighter, keeps context visible
      blur: "bg-black/40 backdrop-blur-sm",
    },
  },
  defaultVariants: { tone: "dim" },
});

export const dialogSurface =
  "bg-overlay rounded-xl border border-white/10 text-white shadow-xl";

const contentVariants = cva(
  "data-[state=closed]:animate-out data-[state=open]:animate-in fixed z-50 duration-200",
  {
    variants: {
      size: {
        default: cn(
          dialogSurface,
          "top-1/2 left-1/2 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 p-6",
        ),
        // media lightbox
        fullscreen: "bg-scrim inset-0 flex h-dvh w-screen flex-col text-white",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
    VariantProps<typeof contentVariants>
>(({ className, children, size, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        scrimVariants(),
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in z-50",
      )}
    />
    <DialogPrimitive.Content
      className={cn(contentVariants({ size }), className)}
      ref={ref}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute top-3 right-3 rounded-md text-white/70 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1 text-left", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    className={cn("text-lg font-semibold", className)}
    ref={ref}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    className={cn("text-sm text-white/70", className)}
    ref={ref}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
