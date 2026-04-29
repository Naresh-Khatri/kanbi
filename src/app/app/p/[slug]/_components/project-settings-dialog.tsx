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
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

export function ProjectSettingsDialog({
  projectId,
  slug,
  open,
  onOpenChange,
}: {
  projectId: string;
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const project = api.project.bySlug.useQuery({ slug }).data;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    if (!open || !project) return;
    setName(project.name);
    setDescription(project.description ?? "");
    setSystemPrompt(project.systemPrompt ?? "");
  }, [open, project]);

  const update = api.project.update.useMutation({
    onSuccess: async () => {
      toast.success("Project updated");
      onOpenChange(false);
      await Promise.all([
        utils.project.bySlug.invalidate({ slug }),
        utils.project.list.invalidate(),
      ]);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>
            Edit project details and AI context.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({
              projectId,
              name: name.trim() || undefined,
              description: description.trim() ? description.trim() : null,
              systemPrompt: systemPrompt.trim() ? systemPrompt.trim() : null,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-name">Name</Label>
            <Input
              id="settings-name"
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-description">Description</Label>
            <Textarea
              id="settings-description"
              onChange={(e) => setDescription(e.target.value)}
              value={description}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-system-prompt">
              AI context
              <span className="ml-2 text-xs font-normal text-white/40">
                extra context passed to the task drafter
              </span>
            </Label>
            <Textarea
              id="settings-system-prompt"
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="What this project is, who it's for, how you like tasks to be framed."
              rows={5}
              value={systemPrompt}
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
            <Button disabled={update.isPending} type="submit">
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
