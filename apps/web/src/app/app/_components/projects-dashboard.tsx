"use client";

import {
  ArchiveIcon,
  ChevronRightIcon,
  EllipsisIcon,
  FolderKanbanIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DeleteProjectDialog } from "@/app/app/p/[slug]/settings/_components/delete-project-dialog";
import { useAppShell } from "@/components/keybinds/shell-store";
import { ProjectDot } from "@/components/project-dot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import {
  Menu,
  MenuItem,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";
import { invalidateProjectLifecycle } from "./invalidate-project-lifecycle";
import {
  ProjectLifecycleDialog,
  shouldSkipProjectLifecycleDialog,
  type ProjectLifecycleAction,
} from "./project-lifecycle-dialog";

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
  const [newOpen, setNewOpen] = useState(false);
  const active = projects.filter((p) => p.status === "active");
  const onHold = projects.filter((p) => p.status === "on_hold");

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Create a project, get a board, start shipping.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <PlusIcon aria-hidden="true" /> New project
        </Button>
        <NewProjectDialog onOpenChange={setNewOpen} open={newOpen} />
      </div>

      {active.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed md:py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanbanIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {projects.length === 0 ? "No projects yet" : "No active projects"}
            </EmptyTitle>
            <EmptyDescription>
              {projects.length === 0
                ? "Every project comes with a board. Create your first one."
                : "Reactivate one from On hold below, or start something new."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setNewOpen(true)} variant="outline">
              <PlusIcon aria-hidden="true" /> New project
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((p) => (
            <ProjectCardItem key={p.id} project={p} />
          ))}
          <li className="flex">
            <button
              className="text-muted-foreground hover:border-ring/48 hover:bg-accent/48 hover:text-foreground focus-visible:ring-ring flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-sm transition-colors outline-none focus-visible:ring-2"
              onClick={() => setNewOpen(true)}
              type="button"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              New project
            </button>
          </li>
        </ul>
      )}

      {onHold.length > 0 ? (
        <Collapsible className="flex flex-col gap-2">
          <CollapsibleTrigger
            className="group text-muted-foreground w-fit"
            render={<Button size="xs" variant="ghost" />}
          >
            <ChevronRightIcon
              aria-hidden="true"
              className="transition-transform duration-200 group-data-panel-open:rotate-90"
            />
            On hold · {onHold.length}
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <Frame>
              <FramePanel className="p-0">
                <ul className="flex flex-col divide-y">
                  {onHold.map((p) => (
                    <OnHoldRow key={p.id} project={p} />
                  ))}
                </ul>
              </FramePanel>
            </Frame>
          </CollapsiblePanel>
        </Collapsible>
      ) : null}
    </section>
  );
}

function ProjectCardItem({ project }: { project: ProjectCard }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const pct =
    project.totalTasks > 0
      ? Math.round((project.doneTasks / project.totalTasks) * 100)
      : 0;

  return (
    <li className="relative">
      <Card
        className="hover:bg-accent/48 focus-visible:ring-ring h-full min-h-36 justify-between gap-4 p-4 transition-colors outline-none focus-visible:ring-2"
        render={<Link href={`/app/p/${project.slug}`} />}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 pe-8">
            <ProjectDot className="size-2.5" color={project.color} />
            <span className="truncate font-medium">{project.name}</span>
          </div>
          {project.description ? (
            <p className="text-muted-foreground line-clamp-2 text-xs">
              {project.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center gap-3 text-xs tabular-nums">
            {project.inProgressTasks > 0 ? (
              <span className="text-info-foreground">
                {project.inProgressTasks} in progress
              </span>
            ) : null}
            <span className="ms-auto">
              {project.totalTasks > 0
                ? `${project.doneTasks}/${project.totalTasks} done`
                : "No tasks yet"}
            </span>
          </div>
          <div className="bg-muted h-1 overflow-hidden rounded-full">
            <div
              className="bg-foreground/48 h-full rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </Card>
      <div className="absolute end-3 top-3">
        <ProjectMenu
          onDeleteRequest={() => setDeleteOpen(true)}
          project={project}
        />
      </div>
      {project.role === "owner" ? (
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

  return (
    <li className="flex items-center gap-2 py-1.5 ps-4 pe-2">
      <Link
        className="text-muted-foreground hover:text-foreground flex min-w-0 flex-1 items-center gap-2.5 transition-colors"
        href={`/app/p/${project.slug}`}
      >
        <ProjectDot color={project.color} />
        <span className="truncate text-sm">{project.name}</span>
        <span className="ms-auto shrink-0 text-xs tabular-nums">
          {project.doneTasks}/{project.totalTasks}
        </span>
      </Link>
      <ProjectMenu
        onDeleteRequest={() => setDeleteOpen(true)}
        project={project}
      />
      {project.role === "owner" ? (
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
      if (variables.status === "archived") {
        toastManager.add({ type: "success", title: "Project archived" });
      }
    },
    onError: (err) =>
      toastManager.add({
        type: "error",
        title: "Couldn't update project",
        description: err.message,
      }),
  });

  function applyStatus(status: "active" | ProjectLifecycleAction) {
    setStatus.mutate({ projectId: project.id, status });
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
      <Menu>
        <MenuTrigger
          aria-label="Project actions"
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <EllipsisIcon aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-44">
          <MenuLinkItem
            render={<Link href={`/app/p/${project.slug}/settings`} />}
          >
            <SettingsIcon aria-hidden="true" /> Settings
          </MenuLinkItem>
          {canWrite ? (
            <MenuItem
              onClick={() =>
                project.status === "active"
                  ? requestLifecycleAction("on_hold")
                  : applyStatus("active")
              }
            >
              {project.status === "active" ? (
                <>
                  <PauseCircleIcon aria-hidden="true" /> Put on hold
                </>
              ) : (
                <>
                  <PlayCircleIcon aria-hidden="true" /> Reactivate
                </>
              )}
            </MenuItem>
          ) : null}
          {isOwner ? (
            <>
              <MenuItem onClick={() => requestLifecycleAction("archived")}>
                <ArchiveIcon aria-hidden="true" /> Archive
              </MenuItem>
              <MenuSeparator />
              <MenuItem onClick={onDeleteRequest} variant="destructive">
                <Trash2Icon aria-hidden="true" /> Delete
              </MenuItem>
            </>
          ) : null}
        </MenuPopup>
      </Menu>

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
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const createProjectToken = useAppShell((s) => s.createProjectToken);

  useEffect(() => {
    if (createProjectToken > 0) onOpenChange(true);
  }, [createProjectToken, onOpenChange]);

  const create = api.project.create.useMutation({
    onSuccess: async () => {
      toastManager.add({ type: "success", title: "Project created" });
      onOpenChange(false);
      setName("");
      setDescription("");
      setSystemPrompt("");
      setShowSystemPrompt(false);
      await utils.project.list.invalidate();
    },
    onError: (err) =>
      toastManager.add({
        type: "error",
        title: "Couldn't create project",
        description: err.message,
      }),
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup>
        <Form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              name,
              description: description || undefined,
              systemPrompt: systemPrompt.trim() || undefined,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Each project comes with a board out of the box.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                autoFocus
                onChange={(e) => setName(e.target.value)}
                required
                value={name}
              />
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea
                onChange={(e) => setDescription(e.target.value)}
                value={description}
              />
            </Field>
            {showSystemPrompt ? (
              <Field>
                <FieldLabel>AI context</FieldLabel>
                <Textarea
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="e.g. This is a SaaS for dentists. Common issues: appointment booking, payments, patient records. We triage aggressively — small fixes go straight to In Progress."
                  rows={4}
                  value={systemPrompt}
                />
                <FieldDescription>
                  Optional. Helps the task drafter understand your project.
                </FieldDescription>
              </Field>
            ) : (
              <Button
                className="self-start"
                onClick={() => setShowSystemPrompt(true)}
                size="xs"
                type="button"
                variant="ghost"
              >
                <PlusIcon aria-hidden="true" /> Add AI context
              </Button>
            )}
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button loading={create.isPending} type="submit">
              Create project
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}
