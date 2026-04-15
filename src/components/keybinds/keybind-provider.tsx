"use client";

import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";

import { CommandPalette } from "@/components/command/command-palette";
import { KeybindCheatsheet } from "@/components/keybinds/keybind-cheatsheet";
import { useAppShell } from "@/components/keybinds/shell-store";

export function KeybindProvider() {
  const router = useRouter();
  const {
    paletteOpen,
    setPaletteOpen,
    setCheatsheetOpen,
    requestCreateProject,
    requestCreateTask,
  } = useAppShell();

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

  return (
    <>
      <CommandPalette />
      <KeybindCheatsheet />
    </>
  );
}
