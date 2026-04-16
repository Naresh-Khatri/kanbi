"use client";

import type { ReactNode } from "react";
import { create } from "zustand";

type HeaderSlot = { left: ReactNode; right: ReactNode };

type AppShellState = {
  paletteOpen: boolean;
  cheatsheetOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  setCheatsheetOpen: (open: boolean) => void;
  /** Incremented to signal "create a new project" intent to the dashboard. */
  createProjectToken: number;
  /** Incremented to signal "create a task on the current board". */
  createTaskToken: number;
  requestCreateProject: () => void;
  requestCreateTask: () => void;
  /** Per-page slots rendered inside the global app header. */
  headerSlot: HeaderSlot;
  setHeaderSlot: (slot: HeaderSlot) => void;
  clearHeaderSlot: () => void;
};

const EMPTY_SLOT: HeaderSlot = { left: null, right: null };

export const useAppShell = create<AppShellState>((set) => ({
  paletteOpen: false,
  cheatsheetOpen: false,
  createProjectToken: 0,
  createTaskToken: 0,
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setCheatsheetOpen: (open) => set({ cheatsheetOpen: open }),
  requestCreateProject: () =>
    set((s) => ({ createProjectToken: s.createProjectToken + 1 })),
  requestCreateTask: () =>
    set((s) => ({ createTaskToken: s.createTaskToken + 1 })),
  headerSlot: EMPTY_SLOT,
  setHeaderSlot: (slot) => set({ headerSlot: slot }),
  clearHeaderSlot: () => set({ headerSlot: EMPTY_SLOT }),
}));
