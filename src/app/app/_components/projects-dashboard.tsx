"use client";

import { MoreHorizontal, Plus, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DeleteProjectDialog } from "@/app/app/p/[slug]/settings/_components/delete-project-dialog";
import { useAppShell } from "@/components/keybinds/shell-store";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

type ProjectCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  role: "owner" | "editor" | "viewer";
};

export function ProjectsDashboard() {
  const [projects] = api.project.list.useSuspenseQuery();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-white/60">
            Create a project, get a board, start shipping.
          </p>
        </div>
        <NewProjectDialog />
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-white/60">
          No projects yet. Create your first one.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCardItem key={p.id} project={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectCardItem({ project }: { project: ProjectCard }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isOwner = project.role === "owner";

  return (
    <li className="relative">
      <Link
        className="block rounded-xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/5"
        href={`/app/p/${project.slug}`}
      >
        <div className="flex items-center gap-2 pr-8">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ background: project.color ?? "#6366f1" }}
          />
          <span className="truncate font-medium">{project.name}</span>
        </div>
        {project.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-white/60">
            {project.description}
          </p>
        ) : null}
      </Link>
      <div className="absolute top-3 right-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Project actions"
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
              onClick={(e) => e.preventDefault()}
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link href={`/app/p/${project.slug}/settings`}>
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            {isOwner ? (
              <DropdownMenuItem
                destructive
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isOwner ? (
        <DeleteProjectDialog
          onOpenChange={setDeleteOpen}
          open={deleteOpen}
          projectId={project.id}
          projectName={project.name}
        />
      ) : null}
    </li>
  );
}

function NewProjectDialog() {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const createProjectToken = useAppShell((s) => s.createProjectToken);

  useEffect(() => {
    if (createProjectToken > 0) setOpen(true);
  }, [createProjectToken]);

  const create = api.project.create.useMutation({
    onSuccess: async () => {
      toast.success("Project created");
      setOpen(false);
      setName("");
      setDescription("");
      setSystemPrompt("");
      setShowSystemPrompt(false);
      await utils.project.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Each project comes with a board out of the box.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              name,
              description: description || undefined,
              systemPrompt: systemPrompt.trim() || undefined,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              autoFocus
              id="project-name"
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              onChange={(e) => setDescription(e.target.value)}
              value={description}
            />
          </div>
          {showSystemPrompt ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-system-prompt">
                AI context
                <span className="ml-2 text-xs font-normal text-white/40">
                  optional — helps the task drafter understand your project
                </span>
              </Label>
              <Textarea
                id="project-system-prompt"
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="e.g. This is a SaaS for dentists. Common issues: appointment booking, payments, patient records. We triage aggressively — small fixes go straight to In Progress."
                rows={4}
                value={systemPrompt}
              />
            </div>
          ) : (
            <button
              className="self-start text-xs text-white/50 transition hover:text-white/80"
              onClick={() => setShowSystemPrompt(true)}
              type="button"
            >
              + Add AI context
            </button>
          )}
          <DialogFooter>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={create.isPending} type="submit">
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
