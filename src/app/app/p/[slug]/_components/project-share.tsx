"use client";

import { useParams } from "next/navigation";

import { api } from "@/trpc/react";
import { ShareDialog } from "./share-dialog";

export function ProjectShare() {
  const { slug } = useParams<{ slug: string }>();
  const project = api.project.bySlug.useQuery({ slug }).data;
  const board = api.board.get.useQuery(
    { boardId: project?.boardId ?? "" },
    { enabled: !!project?.boardId },
  ).data;

  if (!project || !board?.access.canAdmin) return null;

  return <ShareDialog boardId={project.boardId} projectId={project.id} />;
}
