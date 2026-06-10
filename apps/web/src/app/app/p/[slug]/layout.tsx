import { notFound } from "next/navigation";

import { AppHeader } from "@/app/app/_components/app-header";
import { ProjectAiButton } from "@/app/app/p/[slug]/_components/project-ai-button";
import { ProjectInfo } from "@/app/app/p/[slug]/_components/project-info";
import { ProjectTeamButton } from "@/app/app/p/[slug]/_components/project-team-button";
import { resolveProject } from "@/app/app/p/[slug]/_lib/resolve-project";
import { api, HydrateClient } from "@/trpc/server";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await resolveProject(slug);
  if (!project) notFound();

  void api.user.me.prefetch();
  void api.project.list.prefetch();
  void api.project.bySlug.prefetch({ slug });
  void api.board.get.prefetch({ boardId: project.boardId });
  void api.project.members.prefetch({ projectId: project.id });
  if (project.role === "owner") {
    void api.project.listInvites.prefetch({ projectId: project.id });
  }

  return (
    <HydrateClient>
      <AppHeader
        end={
          <>
            <ProjectAiButton />
            <ProjectTeamButton />
          </>
        }
        start={<ProjectInfo />}
      />
      {children}
    </HydrateClient>
  );
}
