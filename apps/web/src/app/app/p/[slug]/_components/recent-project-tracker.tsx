"use client";

import { useEffect } from "react";

import { useRecentProjects } from "@/components/keybinds/recents-store";

// invisible; records board visits for the recents-first command palette + jump shortcuts
export function RecentProjectTracker({ slug }: { slug: string }) {
  const visit = useRecentProjects((s) => s.visit);

  useEffect(() => {
    visit(slug);
  }, [slug, visit]);

  return null;
}
