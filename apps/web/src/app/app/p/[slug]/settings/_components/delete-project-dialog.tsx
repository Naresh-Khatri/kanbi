"use client";

import { useEffect, useState } from "react";

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
import { Field, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";

export function DeleteProjectDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  onDeleted,
}: {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const utils = api.useUtils();
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (!open) setConfirm("");
  }, [open]);

  const del = api.project.delete.useMutation({
    onSuccess: async () => {
      toastManager.add({ type: "success", title: "Project deleted" });
      onOpenChange(false);
      await utils.project.list.invalidate();
      onDeleted?.();
    },
    onError: (err) => toastManager.add({ type: "error", title: err.message }),
  });

  const matches = confirm.trim() === projectName;

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogPopup>
        <Form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!matches) return;
            del.mutate({ projectId });
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <strong className="text-foreground font-medium">
                {projectName}
              </strong>
              , its board, all tasks, comments, attachments, members, invites,
              and share links. This cannot be undone.
            </AlertDialogDescription>
            <Field className="mt-3" name="confirm">
              <FieldLabel>
                Type{" "}
                <span className="text-foreground font-mono">{projectName}</span>{" "}
                to confirm
              </FieldLabel>
              <Input
                autoComplete="off"
                autoFocus
                onChange={(e) => setConfirm(e.target.value)}
                value={confirm}
              />
            </Field>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </AlertDialogClose>
            <Button
              disabled={!matches}
              loading={del.isPending}
              type="submit"
              variant="destructive"
            >
              Delete project
            </Button>
          </AlertDialogFooter>
        </Form>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
