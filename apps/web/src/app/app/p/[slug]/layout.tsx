import { notFound } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";

import { AppHeader } from "@/app/app/_components/app-header";
import { ProjectAiButton } from "@/app/app/p/[slug]/_components/project-ai-button";
import { ProjectArchiveStatus } from "@/app/app/p/[slug]/_components/project-archive-status";
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
            <ProjectArchiveStatus
              canRestore={project.role === "owner"}
              projectId={project.id}
              slug={project.slug}
              status={project.status}
            />
            <ProjectAiButton />
            <ProjectTeamButton />
            <Link
              aria-label="Project settings"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
              href={`/app/p/${slug}/settings`}
              title="Project settings"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Settings</span>
            </Link>
          </>
        }
        start={<ProjectInfo />}
      />
      {children}
    </HydrateClient>
  );
}
