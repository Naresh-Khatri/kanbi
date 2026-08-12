"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_RECENTS = 10;

type RecentProjectsState = {
  slugs: string[];
  visit: (slug: string) => void;
};

// most-recent-first list of visited project slugs, for recents-first switching
export const useRecentProjects = create<RecentProjectsState>()(
  persist(
    (set) => ({
      slugs: [],
      visit: (slug) =>
        set((s) => ({
          slugs: [slug, ...s.slugs.filter((x) => x !== slug)].slice(
            0,
            MAX_RECENTS,
          ),
        })),
    }),
    { name: "kanbi:recent-projects" },
  ),
);
