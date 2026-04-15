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

  return (
    <HydrateClient>
      <BoardView
        boardId={project.boardId}
        projectId={project.id}
        projectName={project.name}
        projectSlug={project.slug}
      />
    </HydrateClient>
  );
}
