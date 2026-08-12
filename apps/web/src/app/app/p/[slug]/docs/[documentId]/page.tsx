import { notFound } from "next/navigation";

import { DocsWorkspace } from "@/app/app/p/[slug]/docs/_components/docs-workspace";
import { resolveProject } from "@/app/app/p/[slug]/_lib/resolve-project";
import { api } from "@/trpc/server";

export default async function ProjectDocumentPage({
  params,
}: {
  params: Promise<{ slug: string; documentId: string }>;
}) {
  const { slug, documentId } = await params;
  const project = await resolveProject(slug);
  if (!project) notFound();

  void api.document.list.prefetch({ projectId: project.id });
  void api.document.authoringContext.prefetch({ projectId: project.id });
  void api.document.get.prefetch({ projectId: project.id, documentId });

  return (
    <DocsWorkspace
      canWrite={project.role === "owner" || project.role === "editor"}
      initialDocumentId={documentId}
      projectId={project.id}
      slug={slug}
    />
  );
}
