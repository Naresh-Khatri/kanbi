import { notFound } from "next/navigation";

import { resolveProject } from "@/app/app/p/[slug]/_lib/resolve-project";
import { api } from "@/trpc/server";
import { SettingsView } from "./_components/settings-view";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await resolveProject(slug);
  if (!project) notFound();

  void api.project.members.prefetch({ projectId: project.id });
  if (project.role === "owner") {
    void api.project.listInvites.prefetch({ projectId: project.id });
    void api.share.list.prefetch({ boardId: project.boardId });
  }

  return <SettingsView slug={slug} />;
}
