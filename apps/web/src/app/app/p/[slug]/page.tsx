import { notFound } from "next/navigation";

import { AiDraftController } from "@/app/app/p/[slug]/_components/ai-draft-controller";
import { BoardView } from "@/app/app/p/[slug]/_components/board/board-view";
import { RecentProjectTracker } from "@/app/app/p/[slug]/_components/recent-project-tracker";
import { resolveProject } from "@/app/app/p/[slug]/_lib/resolve-project";
import { api } from "@/trpc/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await resolveProject(slug);
  if (!project) notFound();
  void api.board.get.prefetch({ boardId: project.boardId });

  return (
    <>
      <BoardView
        boardId={project.boardId}
        projectId={project.id}
        projectKey={project.key}
        projectSlug={project.slug}
      />
      <AiDraftController boardId={project.boardId} projectId={project.id} />
      <RecentProjectTracker slug={project.slug} />
    </>
  );
}
