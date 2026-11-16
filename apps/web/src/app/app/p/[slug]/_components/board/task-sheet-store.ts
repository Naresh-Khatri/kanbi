"use client";

import { create } from "zustand";

// outside board-view so open/close re-renders only the sheet, not every column
export const useTaskSheet = create<{ openId: string | null }>(() => ({
  openId: null,
}));

export const openTaskSheet = (openId: string) =>
  useTaskSheet.setState({ openId });
export const closeTaskSheet = () => useTaskSheet.setState({ openId: null });
export const isTaskSheetOpen = () => useTaskSheet.getState().openId != null;
