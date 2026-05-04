"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      toast.success("Project deleted");
      onOpenChange(false);
      await utils.project.list.invalidate();
      onDeleted?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const matches = confirm.trim() === projectName;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            This permanently deletes <strong>{projectName}</strong>, its board,
            all tasks, comments, attachments, members, invites, and share
            links. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!matches) return;
            del.mutate({ projectId });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-name">
              Type{" "}
              <span className="font-mono text-white">{projectName}</span> to
              confirm
            </Label>
            <Input
              autoComplete="off"
              autoFocus
              id="confirm-name"
              onChange={(e) => setConfirm(e.target.value)}
              value={confirm}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={!matches || del.isPending}
              type="submit"
              variant="destructive"
            >
              {del.isPending ? "Deleting…" : "Delete project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
