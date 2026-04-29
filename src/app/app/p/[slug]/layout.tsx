import { notFound } from "next/navigation";

import { AppHeader } from "@/app/app/_components/app-header";
import { ProjectAiButton } from "@/app/app/p/[slug]/_components/project-ai-button";
import { ProjectInfo } from "@/app/app/p/[slug]/_components/project-info";
import { ProjectInvitesBadge } from "@/app/app/p/[slug]/_components/project-invites-badge";
import { ProjectMembers } from "@/app/app/p/[slug]/_components/project-members";
import { ProjectRole } from "@/app/app/p/[slug]/_components/project-role";
import { ProjectSettingsLink } from "@/app/app/p/[slug]/_components/project-settings-link";
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
            <ProjectMembers />
            <ProjectRole />
            <ProjectInvitesBadge />
            <ProjectSettingsLink />
          </>
        }
        start={<ProjectInfo />}
      />
      {children}
    </HydrateClient>
  );
}
