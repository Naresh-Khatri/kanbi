import { notFound } from "next/navigation";

import { resolveProject } from "@/app/app/p/[slug]/_lib/resolve-project";
import { api } from "@/trpc/server";
import { MilestoneSettings } from "../_components/settings-pages";

export default async function ProjectMilestoneSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await resolveProject(slug);
  if (!project) notFound();

  void api.milestone.list.prefetch({
    boardId: project.boardId,
    includeClosed: true,
  });

  return <MilestoneSettings slug={slug} />;
}
