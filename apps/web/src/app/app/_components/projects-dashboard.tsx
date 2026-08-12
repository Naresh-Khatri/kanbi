"use client";

import { formatRelative } from "@kanbi/shared";
import {
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
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
  status: "active" | "on_hold";
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  lastActivityAt: Date | null;
};

export function ProjectsDashboard() {
  const [projects] = api.project.list.useSuspenseQuery();
  const active = projects.filter((p) => p.status === "active");
  const onHold = projects.filter((p) => p.status === "on_hold");

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
        <>
          {active.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((p, i) => (
                <ProjectCardItem
                  jumpNumber={i < 9 ? i + 1 : undefined}
                  key={p.id}
                  project={p}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/40">No active projects.</p>
          )}

          {onHold.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-medium tracking-wide text-white/40 uppercase">
                On hold
              </h2>
              <ul className="flex flex-col divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
                {onHold.map((p) => (
                  <OnHoldRow key={p.id} project={p} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ProjectCardItem({
  project,
  jumpNumber,
}: {
  project: ProjectCard;
  jumpNumber?: number;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isOwner = project.role === "owner";
  const pct =
    project.totalTasks > 0
      ? Math.round((project.doneTasks / project.totalTasks) * 100)
      : 0;

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
          <p className="mt-1.5 line-clamp-1 text-sm text-white/60">
            {project.description}
          </p>
        ) : null}

        <div className="mt-3 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/50"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-white/40">
            {project.doneTasks}/{project.totalTasks}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-white/40">
          <span>
            {project.inProgressTasks > 0
              ? `${project.inProgressTasks} in flight`
              : null}
          </span>
          <span>
            {project.lastActivityAt
              ? formatRelative(project.lastActivityAt)
              : "no activity yet"}
          </span>
        </div>
      </Link>
      <div className="absolute top-3 right-3">
        <ProjectMenu
          onDeleteRequest={() => setDeleteOpen(true)}
          project={project}
        />
      </div>
      {jumpNumber ? (
        <span className="pointer-events-none absolute right-3 bottom-3 font-mono text-[10px] text-white/25">
          {jumpNumber}
        </span>
      ) : null}
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

function OnHoldRow({ project }: { project: ProjectCard }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isOwner = project.role === "owner";

  return (
    <li className="flex items-center gap-2 bg-white/[0.01] px-3 py-2 opacity-60 transition hover:opacity-100">
      <Link
        className="flex min-w-0 flex-1 items-center gap-2"
        href={`/app/p/${project.slug}`}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: project.color ?? "#6366f1" }}
        />
        <span className="truncate text-sm">{project.name}</span>
        <span className="ml-auto shrink-0 text-xs tabular-nums text-white/40">
          {project.doneTasks}/{project.totalTasks}
        </span>
      </Link>
      <ProjectMenu
        onDeleteRequest={() => setDeleteOpen(true)}
        project={project}
      />
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

function ProjectMenu({
  project,
  onDeleteRequest,
}: {
  project: ProjectCard;
  onDeleteRequest: () => void;
}) {
  const utils = api.useUtils();
  const isOwner = project.role === "owner";
  const canWrite = project.role !== "viewer";

  const setStatus = api.project.setStatus.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  return (
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
        {canWrite ? (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setStatus.mutate({
                projectId: project.id,
                status: project.status === "active" ? "on_hold" : "active",
              });
            }}
          >
            {project.status === "active" ? (
              <>
                <PauseCircle className="h-4 w-4" /> Put on hold
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" /> Reactivate
              </>
            )}
          </DropdownMenuItem>
        ) : null}
        {isOwner ? (
          <DropdownMenuItem
            destructive
            onSelect={(e) => {
              e.preventDefault();
              onDeleteRequest();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
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
