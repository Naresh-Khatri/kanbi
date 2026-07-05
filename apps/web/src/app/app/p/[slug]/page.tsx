import { notFound } from "next/navigation";

import { AiDraftController } from "@/app/app/p/[slug]/_components/ai-draft-controller";
import { BoardView } from "@/app/app/p/[slug]/_components/board/board-view";
import { resolveProject } from "@/app/app/p/[slug]/_lib/resolve-project";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await resolveProject(slug);
  if (!project) notFound();

  return (
    <>
      <BoardView
        boardId={project.boardId}
        projectId={project.id}
        projectKey={project.key}
        projectSlug={project.slug}
      />
      <AiDraftController boardId={project.boardId} projectId={project.id} />
    </>
  );
}
