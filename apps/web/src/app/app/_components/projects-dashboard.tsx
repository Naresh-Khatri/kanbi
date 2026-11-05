"use client";

import {
  Archive,
  ChevronRight,
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
import { invalidateProjectLifecycle } from "./invalidate-project-lifecycle";
import {
  ProjectLifecycleDialog,
  shouldSkipProjectLifecycleDialog,
  type ProjectLifecycleAction,
} from "./project-lifecycle-dialog";

import { Dot } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import {
  cardVariants,
  EmptyState,
  PageSubtitle,
  PageTitle,
} from "@/components/ui/surface";
import { DEFAULT_PROJECT_COLOR } from "@/lib/palette";
import { api } from "@/trpc/react";

type ProjectCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  role: "owner" | "editor" | "viewer";
  status: "active" | "on_hold" | "archived";
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  lastActivityAt: Date | null;
};

export function ProjectsDashboard() {
  const [projects] = api.project.list.useSuspenseQuery();
  const [showOnHold, setShowOnHold] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const active = projects.filter((p) => p.status === "active");
  const onHold = projects.filter((p) => p.status === "on_hold");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <PageTitle>Projects</PageTitle>
          <PageSubtitle>
            Create a project, get a board, start shipping.
          </PageSubtitle>
        </div>
        <NewProjectDialog onOpenChange={setNewOpen} open={newOpen} />
      </div>

      {projects.length === 0 ? (
        <EmptyState size="lg">
          No projects yet. Create your first one.
        </EmptyState>
      ) : (
        <>
          {active.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((p) => (
                <ProjectCardItem key={p.id} project={p} />
              ))}
              <li className="flex">
                <Button
                  className="min-h-32 w-full flex-col"
                  onClick={() => setNewOpen(true)}
                  type="button"
                  variant="dashed"
                >
                  <Plus className="h-4 w-4" />
                  New project
                </Button>
              </li>
            </ul>
          ) : (
            <EmptyState size="sm">No active projects.</EmptyState>
          )}

          {onHold.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Button
                aria-controls="on-hold-projects"
                aria-expanded={showOnHold}
                className="w-fit gap-1.5 px-1"
                onClick={() => setShowOnHold((open) => !open)}
                size="xs"
                type="button"
                variant="link"
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${showOnHold ? "rotate-90" : ""}`}
                />
                On hold · {onHold.length}
              </Button>
              {showOnHold ? (
                <ul
                  className="flex flex-col divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10"
                  id="on-hold-projects"
                >
                  {onHold.map((p) => (
                    <OnHoldRow key={p.id} project={p} />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
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
        className={cn(
          cardVariants({ tone: "muted", padding: "none", interactive: true }),
          "flex h-full min-h-32 flex-col justify-between gap-4 p-4",
        )}
        href={`/app/p/${project.slug}`}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 pr-8">
            <Dot color={project.color ?? DEFAULT_PROJECT_COLOR} size="lg" />
            <span className="truncate font-medium">{project.name}</span>
          </div>
          {project.description ? (
            <p className="line-clamp-2 text-xs text-white/70">
              {project.description}
            </p>
          ) : null}
        </div>
        <p className="flex items-center gap-3 text-xs text-white/40 tabular-nums">
          {project.inProgressTasks > 0 ? (
            <span>{project.inProgressTasks} in progress</span>
          ) : null}
          {project.totalTasks > 0 ? (
            <span className="ml-auto">
              {project.doneTasks}/{project.totalTasks} done
            </span>
          ) : null}
        </p>
      </Link>
      <div className="absolute top-3.5 right-3">
        <ProjectMenu
          onDeleteRequest={() => setDeleteOpen(true)}
          project={project}
        />
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

function OnHoldRow({ project }: { project: ProjectCard }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isOwner = project.role === "owner";

  return (
    <li className="flex items-center gap-2 px-3 py-2 opacity-60 transition hover:opacity-100">
      <Link
        className="flex min-w-0 flex-1 items-center gap-2"
        href={`/app/p/${project.slug}`}
      >
        <Dot color={project.color ?? DEFAULT_PROJECT_COLOR} />
        <span className="truncate text-sm">{project.name}</span>
        <span className="ml-auto shrink-0 text-xs text-white/40 tabular-nums">
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
  const [lifecycleAction, setLifecycleAction] =
    useState<ProjectLifecycleAction | null>(null);
  const isOwner = project.role === "owner";
  const canWrite = project.role !== "viewer";

  const setStatus = api.project.setStatus.useMutation({
    onSuccess: async (_data, variables) => {
      setLifecycleAction(null);
      await invalidateProjectLifecycle(utils);
      if (variables.status === "archived") toast.success("Project archived");
    },
    onError: (err) => toast.error(err.message),
  });

  function applyStatus(status: "active" | ProjectLifecycleAction) {
    setStatus.mutate({
      projectId: project.id,
      status,
    });
  }

  function requestLifecycleAction(action: ProjectLifecycleAction) {
    if (shouldSkipProjectLifecycleDialog(action)) {
      applyStatus(action);
      return;
    }

    setLifecycleAction(action);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Project actions"
            onClick={(e) => e.preventDefault()}
            size="icon-sm"
            type="button"
            variant="quiet"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/app/p/${project.slug}/settings`}>
              <Settings className="h-4 w-4" /> Settings
            </Link>
          </DropdownMenuItem>
          {canWrite ? (
            <DropdownMenuItem
              onSelect={() => {
                if (project.status === "active") {
                  requestLifecycleAction("on_hold");
                } else {
                  applyStatus("active");
                }
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
              onSelect={() => requestLifecycleAction("archived")}
            >
              <Archive className="h-4 w-4" /> Archive
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

      <ProjectLifecycleDialog
        action={lifecycleAction}
        isPending={setStatus.isPending}
        key={lifecycleAction ?? "closed"}
        onConfirm={applyStatus}
        onOpenChange={(open) => {
          if (!open) setLifecycleAction(null);
        }}
        projectName={project.name}
      />
    </>
  );
}

function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setOpen = onOpenChange;
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const createProjectToken = useAppShell((s) => s.createProjectToken);

  useEffect(() => {
    if (createProjectToken > 0) setOpen(true);
  }, [createProjectToken, setOpen]);

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
            <Button
              className="self-start"
              onClick={() => setShowSystemPrompt(true)}
              size="inline"
              type="button"
              variant="link"
            >
              + Add AI context
            </Button>
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
