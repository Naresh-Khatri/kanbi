"use client";

import { useAppShell } from "@/components/keybinds/shell-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
              <div className="text-white/50 text-xs uppercase tracking-wide">
                {g.title}
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {g.entries.map((e) => (
                  <li
                    className="flex items-center justify-between"
                    key={e.keys}
                  >
                    <span className="text-white/80">{e.description}</span>
                    <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/80 text-xs">
                      {e.keys}
                    </kbd>
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
