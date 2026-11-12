"use client";

import { useAppShell } from "@/components/keybinds/shell-store";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { KEYBIND_GROUPS } from "@/lib/keybinds";

export function KeybindCheatsheet() {
  const { cheatsheetOpen, setCheatsheetOpen } = useAppShell();
  return (
    <Dialog onOpenChange={setCheatsheetOpen} open={cheatsheetOpen}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Press ? anywhere to open this.</DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-5">
          {KEYBIND_GROUPS.map((g) => (
            <section className="flex flex-col gap-1" key={g.title}>
              <h3 className="text-muted-foreground text-xs font-medium">
                {g.title}
              </h3>
              <ul className="flex flex-col divide-y text-sm">
                {g.entries.map((e) => (
                  <li
                    className="flex items-center justify-between gap-4 py-1.5"
                    key={e.keys}
                  >
                    <span>{e.description}</span>
                    <Kbd>{e.keys}</Kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
