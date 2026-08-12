"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { WhatsNewDialog } from "@/app/app/_components/whats-new-dialog";
import { CommandPalette } from "@/components/command/command-palette";
import { KeybindCheatsheet } from "@/components/keybinds/keybind-cheatsheet";
import { useAppShell } from "@/components/keybinds/shell-store";
import { api } from "@/trpc/react";

const JUMP_KEYS = Array.from({ length: 9 }, (_, i) => i + 1)
  .flatMap((n) => [`g>${n}`, `alt+${n}`])
  .join(",");

export function KeybindProvider() {
  const router = useRouter();
  const {
    paletteOpen,
    setPaletteOpen,
    setCheatsheetOpen,
    requestCreateProject,
    requestCreateTask,
  } = useAppShell();

  // shared cache w/ dashboard + palette; active projects, server order = jump-target order
  const projects = api.project.list.useQuery();
  const activeProjects = useMemo(
    () => projects.data?.filter((p) => p.status === "active") ?? [],
    [projects.data],
  );

  useHotkeys(
    "mod+k",
    (e) => {
      e.preventDefault();
      setPaletteOpen(!paletteOpen);
    },
    { enableOnFormTags: true },
  );

  useHotkeys("shift+/", () => setCheatsheetOpen(true));

  useHotkeys("g>h", () => router.push("/app"));

  useHotkeys("shift+c", (e) => {
    e.preventDefault();
    requestCreateProject();
  });

  useHotkeys("c", (e) => {
    e.preventDefault();
    requestCreateTask();
  });

  useHotkeys(
    JUMP_KEYS,
    (e, handler) => {
      const n = Number(/\d+$/.exec(handler.hotkey)?.[0]);
      const project = activeProjects[n - 1];
      if (!project) return;
      e.preventDefault();
      router.push(`/app/p/${project.slug}`);
    },
    [activeProjects],
  );

  return (
    <>
      <CommandPalette />
      <KeybindCheatsheet />
      <WhatsNewDialog />
    </>
  );
}
