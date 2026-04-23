"use client";

import { useParams } from "next/navigation";

import { api } from "@/trpc/react";

export function ProjectInfo() {
  const { slug } = useParams<{ slug: string }>();
  const project = api.project.bySlug.useQuery({ slug }).data;
  if (!project) return null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: project.color ?? "#6366f1" }}
      />
      <h1 className="truncate font-medium text-sm text-white">
        {project.name}
      </h1>
      {project.description ? (
        <span
          className="hidden max-w-[28ch] truncate text-white/50 text-xs md:inline"
          title={project.description}
        >
          — {project.description}
        </span>
      ) : null}
    </div>
  );
}
