import { notFound } from "next/navigation";

import { AppHeader } from "@/app/app/_components/app-header";
import { ProjectAiButton } from "@/app/app/p/[slug]/_components/project-ai-button";
import { ProjectArchiveStatus } from "@/app/app/p/[slug]/_components/project-archive-status";
import { ProjectInfo } from "@/app/app/p/[slug]/_components/project-info";
import { ProjectSectionNav } from "@/app/app/p/[slug]/_components/project-section-nav";
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
  void api.project.members.prefetch({ projectId: project.id });
  if (project.role === "owner") {
    void api.project.listInvites.prefetch({ projectId: project.id });
  }

  return (
    <HydrateClient>
      <AppHeader
        end={
          <>
            <ProjectArchiveStatus
              canRestore={project.role === "owner"}
              projectId={project.id}
              slug={project.slug}
              status={project.status}
            />
            <ProjectAiButton />
            <ProjectTeamButton />
          </>
        }
        start={
          <>
            <ProjectInfo />
            <ProjectSectionNav slug={slug} />
          </>
        }
      />
      {/* bounded column -> board-view flex-1 fills viewport */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </HydrateClient>
  );
}
