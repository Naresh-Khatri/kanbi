"use client";

import { useAppShell } from "@/components/keybinds/shell-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { SectionLabel } from "@/components/ui/surface";
import { KEYBIND_GROUPS } from "@/lib/keybinds";

export function KeybindCheatsheet() {
  const { cheatsheetOpen, setCheatsheetOpen } = useAppShell();
  return (
    <Dialog onOpenChange={setCheatsheetOpen} open={cheatsheetOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {KEYBIND_GROUPS.map((g) => (
            <div className="flex flex-col gap-1.5" key={g.title}>
              <SectionLabel as="div">{g.title}</SectionLabel>
              <ul className="flex flex-col gap-1 text-sm">
                {g.entries.map((e) => (
                  <li
                    className="flex items-center justify-between"
                    key={e.keys}
                  >
                    <span className="text-white">{e.description}</span>
                    <Kbd variant="key">{e.keys}</Kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
