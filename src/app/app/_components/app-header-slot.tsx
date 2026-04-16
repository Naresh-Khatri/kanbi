"use client";

import { useAppShell } from "@/components/keybinds/shell-store";

export function AppHeaderLeft() {
  const left = useAppShell((s) => s.headerSlot.left);
  if (!left) return null;
  return (
    <>
      <span aria-hidden className="h-4 w-px bg-white/15" />
      {left}
    </>
  );
}

export function AppHeaderRight() {
  const right = useAppShell((s) => s.headerSlot.right);
  return right;
}
