"use client";

import { create } from "zustand";

type AppShellState = {
  paletteOpen: boolean;
  cheatsheetOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  setCheatsheetOpen: (open: boolean) => void;
  /** bump to signal "create new project" to dashboard */
  createProjectToken: number;
  /** bump to signal "create task on current board" */
  createTaskToken: number;
  // held here (not board-view) so trigger doesn't re-render the board;
  // a dedicated controller subscribes to this flag
  aiDraftOpen: boolean;
  requestCreateProject: () => void;
  requestCreateTask: () => void;
  requestAiImport: () => void;
  setAiDraftOpen: (open: boolean) => void;
};

export const useAppShell = create<AppShellState>((set) => ({
  paletteOpen: false,
  cheatsheetOpen: false,
  createProjectToken: 0,
  createTaskToken: 0,
  aiDraftOpen: false,
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setCheatsheetOpen: (open) => set({ cheatsheetOpen: open }),
  requestCreateProject: () =>
    set((s) => ({ createProjectToken: s.createProjectToken + 1 })),
  requestCreateTask: () =>
    set((s) => ({ createTaskToken: s.createTaskToken + 1 })),
  requestAiImport: () => set({ aiDraftOpen: true }),
  setAiDraftOpen: (open) => set({ aiDraftOpen: open }),
}));
