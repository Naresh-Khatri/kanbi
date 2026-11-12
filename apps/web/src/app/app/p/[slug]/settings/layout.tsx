import { notFound } from "next/navigation";

import { resolveProject } from "@/app/app/p/[slug]/_lib/resolve-project";
import { SettingsShell } from "./_components/settings-shell";

export default async function ProjectSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await resolveProject(slug);
  if (!project) notFound();

  return <SettingsShell slug={slug}>{children}</SettingsShell>;
}
