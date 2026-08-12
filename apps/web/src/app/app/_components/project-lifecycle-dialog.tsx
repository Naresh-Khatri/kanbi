"use client";

import { Archive, PauseCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ProjectLifecycleAction = "on_hold" | "archived";

const DISMISS_KEY: Record<ProjectLifecycleAction, string> = {
  on_hold: "kanbi:skip-project-on-hold-confirmation",
  archived: "kanbi:skip-project-archive-confirmation",
};

export function shouldSkipProjectLifecycleDialog(
  action: ProjectLifecycleAction,
) {
  try {
    return window.localStorage.getItem(DISMISS_KEY[action]) === "1";
  } catch {
    return false;
  }
}

export function ProjectLifecycleDialog({
  action,
  projectName,
  isPending,
  onConfirm,
  onOpenChange,
}: {
  action: ProjectLifecycleAction | null;
  projectName: string;
  isPending: boolean;
  onConfirm: (action: ProjectLifecycleAction) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!action) return null;

  const currentAction = action;
  const isArchiving = currentAction === "archived";

  function confirm() {
    if (dontShowAgain) {
      try {
        window.localStorage.setItem(DISMISS_KEY[currentAction], "1");
      } catch {
        // The confirmation can still proceed if browser storage is unavailable.
      }
    }

    onConfirm(currentAction);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isArchiving ? (
              <Archive className="size-4 text-white/50" aria-hidden />
            ) : (
              <PauseCircle className="size-4 text-white/50" aria-hidden />
            )}
            {isArchiving ? "Archive project?" : "Move project to On hold?"}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {isArchiving ? (
              <>
                <strong className="font-medium text-white/80">
                  {projectName}
                </strong>{" "}
                will leave your Home view, project picker, task search, and
                Focus app. Nothing is deleted.
              </>
            ) : (
              <>
                <strong className="font-medium text-white/80">
                  {projectName}
                </strong>{" "}
                will move into the collapsed{" "}
                <strong className="font-medium text-white/80">On hold</strong>{" "}
                section on Home. It stays available in the project picker.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm leading-relaxed text-white/50">
          {isArchiving ? (
            <>
              To access it again, open your user menu and choose{" "}
              <strong className="font-medium text-white/70">
                Archived projects
              </strong>
              , then restore it.
            </>
          ) : (
            <>
              Expand{" "}
              <strong className="font-medium text-white/70">On hold</strong> on
              Home to open it, or reactivate it from the project menu.
            </>
          )}
        </p>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
            className="size-4 accent-white"
          />
          Don&apos;t show this again
        </label>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={confirm}>
            {isPending
              ? isArchiving
                ? "Archiving…"
                : "Moving…"
              : isArchiving
                ? "Archive project"
                : "Move to On hold"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
