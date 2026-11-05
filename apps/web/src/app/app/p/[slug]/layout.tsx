import { notFound } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";

import { AppHeader } from "@/app/app/_components/app-header";
import { ProjectAiButton } from "@/app/app/p/[slug]/_components/project-ai-button";
import { ProjectArchiveStatus } from "@/app/app/p/[slug]/_components/project-archive-status";
import { ProjectInfo } from "@/app/app/p/[slug]/_components/project-info";
import { ProjectSectionNav } from "@/app/app/p/[slug]/_components/project-section-nav";
import { ProjectTeamButton } from "@/app/app/p/[slug]/_components/project-team-button";
import { resolveProject } from "@/app/app/p/[slug]/_lib/resolve-project";
import { Button } from "@/components/ui/button";
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
            <Button
              aria-label="Project settings"
              asChild
              size="icon-md"
              title="Project settings"
              variant="quiet"
            >
              <Link href={`/app/p/${slug}/settings`}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
        start={
          <>
            <ProjectInfo />
            <ProjectSectionNav slug={slug} />
          </>
        }
      />
      {children}
    </HydrateClient>
  );
}
