"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
        // storage unavailable -> still proceed
      }
    }
    onConfirm(currentAction);
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isArchiving ? "Archive project?" : "Move project to On hold?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-pretty">
            {isArchiving ? (
              <>
                <strong className="text-foreground font-medium">
                  {projectName}
                </strong>{" "}
                leaves Home, the project switcher, search and the Focus app. Nothing is
                deleted; restore it any time from Archived projects.
              </>
            ) : (
              <>
                <strong className="text-foreground font-medium">
                  {projectName}
                </strong>{" "}
                moves into the collapsed On hold section on Home. Reactivate it
                from the project menu.
              </>
            )}
          </AlertDialogDescription>
          <Label className="text-muted-foreground mt-2 font-normal">
            <Checkbox
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked)}
            />
            Don&apos;t ask again
          </Label>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            disabled={isPending}
            render={<Button variant="ghost" />}
          >
            Cancel
          </AlertDialogClose>
          <Button loading={isPending} onClick={confirm}>
            {isArchiving ? "Archive project" : "Move to On hold"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
