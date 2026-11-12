"use client";

import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import Link from "next/link";

import { ProjectDot } from "@/components/project-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Frame, FramePanel } from "@/components/ui/frame";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";
import { invalidateProjectLifecycle } from "./invalidate-project-lifecycle";

export function ArchivedProjects() {
  const [projects] = api.project.listArchived.useSuspenseQuery();
  const utils = api.useUtils();
  const restore = api.project.setStatus.useMutation({
    onSuccess: async () => {
      toastManager.add({ type: "success", title: "Project restored" });
      await invalidateProjectLifecycle(utils);
    },
    onError: (error) =>
      toastManager.add({
        type: "error",
        title: "Couldn't restore project",
        description: error.message,
      }),
  });

  if (projects.length === 0) {
    return (
      <Empty className="rounded-2xl border border-dashed md:py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ArchiveIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No archived projects</EmptyTitle>
          <EmptyDescription>
            Archive a project from its menu on Home to tuck it away here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Frame>
      <FramePanel className="p-0">
        <ul className="flex flex-col divide-y">
          {projects.map((project) => (
            <li className="flex items-center gap-3 px-4 py-3" key={project.id}>
              <ProjectDot className="size-2.5" color={project.color} />
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  className="truncate text-sm font-medium hover:underline"
                  href={`/app/p/${project.slug}`}
                >
                  {project.name}
                </Link>
                {project.description ? (
                  <p className="text-muted-foreground truncate text-xs">
                    {project.description}
                  </p>
                ) : null}
              </div>
              {project.role === "owner" ? (
                <Button
                  loading={
                    restore.isPending &&
                    restore.variables?.projectId === project.id
                  }
                  disabled={restore.isPending}
                  onClick={() =>
                    restore.mutate({ projectId: project.id, status: "active" })
                  }
                  size="sm"
                  variant="outline"
                >
                  <ArchiveRestoreIcon aria-hidden="true" /> Restore
                </Button>
              ) : (
                <Badge variant="outline">Archived by owner</Badge>
              )}
            </li>
          ))}
        </ul>
      </FramePanel>
    </Frame>
  );
}
