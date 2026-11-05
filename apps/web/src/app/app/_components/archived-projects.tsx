"use client";

import { ArchiveRestore } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_PROJECT_COLOR } from "@/lib/palette";
import { api } from "@/trpc/react";
import { invalidateProjectLifecycle } from "./invalidate-project-lifecycle";

export function ArchivedProjects() {
  const [projects] = api.project.listArchived.useSuspenseQuery();
  const utils = api.useUtils();
  const restore = api.project.setStatus.useMutation({
    onSuccess: async () => {
      toast.success("Project restored");
      await invalidateProjectLifecycle(utils);
    },
    onError: (error) => toast.error(error.message),
  });

  if (projects.length === 0) {
    return <p className="text-sm text-white/40">No archived projects.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
      {projects.map((project) => (
        <li className="flex items-center gap-3 px-4 py-3" key={project.id}>
          <Dot
            className="opacity-70"
            color={project.color ?? DEFAULT_PROJECT_COLOR}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <Link
              className="truncate text-sm font-medium text-white transition hover:text-white"
              href={`/app/p/${project.slug}`}
            >
              {project.name}
            </Link>
            {project.description ? (
              <p className="truncate text-xs text-white/40">
                {project.description}
              </p>
            ) : null}
          </div>
          {project.role === "owner" ? (
            <Button
              disabled={restore.isPending}
              onClick={() =>
                restore.mutate({
                  projectId: project.id,
                  status: "active",
                })
              }
              size="sm"
              variant="outline"
            >
              <ArchiveRestore className="h-4 w-4" /> Restore
            </Button>
          ) : (
            <span className="text-xs text-white/40">Archived by owner</span>
          )}
        </li>
      ))}
    </ul>
  );
}
