"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { APP_VERSION, releases } from "@/changelog";
import { Button } from "@/components/ui/button";
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
              <span aria-hidden className="text-white/40">
                —
              </span>
              <span>{entry}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <Button asChild size="inline" variant="link">
            <Link href="/app/changelog" onClick={() => onOpenChange(false)}>
              All releases
            </Link>
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            size="sm"
            type="button"
            variant="outline"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
