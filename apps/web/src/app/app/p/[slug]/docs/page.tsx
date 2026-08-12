import { notFound } from "next/navigation";

import { DocsWorkspace } from "@/app/app/p/[slug]/docs/_components/docs-workspace";
import { resolveProject } from "@/app/app/p/[slug]/_lib/resolve-project";
import { api } from "@/trpc/server";

export default async function ProjectDocsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await resolveProject(slug);
  if (!project) notFound();

  void api.document.list.prefetch({ projectId: project.id });
  void api.document.recent.prefetch({ projectId: project.id, limit: 6 });
  void api.document.authoringContext.prefetch({ projectId: project.id });

  return (
    <DocsWorkspace
      canWrite={project.role === "owner" || project.role === "editor"}
      projectId={project.id}
      slug={slug}
    />
  );
}
