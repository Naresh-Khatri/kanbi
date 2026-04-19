import { notFound } from "next/navigation";

import { BoardView } from "@/app/app/p/[slug]/_components/board-view";
import { api, HydrateClient } from "@/trpc/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await api.project.bySlug({ slug }).catch(() => null);
  if (!project) notFound();

  void api.board.get.prefetch({ boardId: project.boardId });
  void api.project.members.prefetch({ projectId: project.id });
  if (project.role === "owner") {
    void api.project.listInvites.prefetch({ projectId: project.id });
  }

  return (
    <HydrateClient>
      <BoardView
        boardId={project.boardId}
        projectColor={project.color}
        projectDescription={project.description}
        projectId={project.id}
        projectName={project.name}
        projectSlug={project.slug}
      />
    </HydrateClient>
  );
}
