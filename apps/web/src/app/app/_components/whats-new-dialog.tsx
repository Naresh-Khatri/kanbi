"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { APP_VERSION, releases } from "@/changelog";
import { ReleaseVideo } from "@/components/release-video";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
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
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>What&apos;s new in v{latest.version}</DialogTitle>
          <DialogDescription>
            Here&apos;s what changed since you were last here.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-4">
          {latest.video ? <ReleaseVideo video={latest.video} /> : null}
          <ul className="text-muted-foreground marker:text-muted-foreground/48 flex list-disc flex-col gap-2 ps-5 text-sm">
            {latest.entries.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </DialogPanel>
        <DialogFooter className="sm:justify-between">
          <Button
            onClick={() => onOpenChange(false)}
            render={<Link href="/app/changelog" />}
            variant="ghost"
          >
            All releases
          </Button>
          <DialogClose render={<Button />}>Got it</DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
