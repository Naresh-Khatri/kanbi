"use client";

import Link from "next/link";

import { api } from "@/trpc/react";
import { AiContextSection } from "./ai-context-section";
import { DangerZoneSection } from "./danger-zone-section";
import { GeneralSection } from "./general-section";
import { MembersSection } from "./members-section";
import { NotificationsSection } from "./notifications-section";
import { SharingSection } from "./sharing-section";

function useProject(slug: string) {
  return api.project.bySlug.useQuery({ slug }).data;
}

export function GeneralSettings({ slug }: { slug: string }) {
  const project = useProject(slug);
  if (!project) return null;
  const canWrite = project.role === "owner" || project.role === "editor";

  return (
    <>
      <GeneralSection canWrite={canWrite} projectId={project.id} slug={slug} />
      <AiContextSection
        canWrite={canWrite}
        projectId={project.id}
        slug={slug}
      />
      <DangerZoneSection
        isOwner={project.role === "owner"}
        projectId={project.id}
        projectName={project.name}
      />
    </>
  );
}

export function AccessSettings({ slug }: { slug: string }) {
  const project = useProject(slug);
  if (!project) return null;
  const isOwner = project.role === "owner";

  return (
    <>
      <MembersSection isOwner={isOwner} projectId={project.id} slug={slug} />
      <SharingSection boardId={project.boardId} isOwner={isOwner} />
    </>
  );
}

export function NotificationSettings({ slug }: { slug: string }) {
  const project = useProject(slug);
  if (!project) return null;

  return (
    <>
      <NotificationsSection projectId={project.id} />
      <p className="text-muted-foreground text-xs">
        Beyond the browser:{" "}
        <Link
          className="text-foreground underline-offset-4 hover:underline"
          href="/docs/mcp"
        >
          connect an AI agent
        </Link>{" "}
        over MCP, or{" "}
        <Link
          className="text-foreground underline-offset-4 hover:underline"
          href="/docs/focus"
        >
          pair the Focus app
        </Link>
        .
      </p>
    </>
  );
}
