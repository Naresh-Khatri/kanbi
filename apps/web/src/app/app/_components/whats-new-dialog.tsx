"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { APP_VERSION, releases } from "@/changelog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SEEN_KEY = "kanbi.last-seen-version";

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false);
  const latest = releases[0];

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    // first visit: adopt the current version silently — new users have no "new"
    if (seen === null) {
      localStorage.setItem(SEEN_KEY, APP_VERSION);
      return;
    }
    if (seen !== APP_VERSION) setOpen(true);
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) localStorage.setItem(SEEN_KEY, APP_VERSION);
  }

  if (!latest) return null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What&apos;s new in v{latest.version}</DialogTitle>
          <DialogDescription>
            Here&apos;s what changed since you were last here.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2 text-sm text-white/70">
          {latest.entries.map((entry) => (
            <li className="flex gap-2" key={entry}>
              <span aria-hidden className="text-white/25">
                —
              </span>
              <span>{entry}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <Link
            className="text-sm text-white/40 transition hover:text-white/70"
            href="/app/changelog"
            onClick={() => onOpenChange(false)}
          >
            All releases
          </Link>
          <button
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm transition hover:bg-white/5"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
