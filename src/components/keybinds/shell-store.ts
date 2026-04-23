"use client";

import { create } from "zustand";

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
};

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
}));
