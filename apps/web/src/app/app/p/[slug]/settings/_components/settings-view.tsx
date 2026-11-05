"use client";

import Link from "next/link";

import { segmentVariants } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { AiContextSection } from "./ai-context-section";
import { DangerZoneSection } from "./danger-zone-section";
import { GeneralSection } from "./general-section";
import { MembersSection } from "./members-section";
import { NotificationsSection } from "./notifications-section";
import { SharingSection } from "./sharing-section";
import { PageTitle } from "@/components/ui/surface";

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "ai", label: "AI context" },
  { id: "members", label: "Members" },
  { id: "sharing", label: "Sharing" },
  { id: "notifications", label: "Notifications" },
  { id: "danger", label: "Danger zone" },
] as const;

export function SettingsView({ slug }: { slug: string }) {
  const project = api.project.bySlug.useQuery({ slug }).data;
  if (!project) return null;

  const isOwner = project.role === "owner";
  const canWrite = project.role === "owner" || project.role === "editor";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8 lg:flex-row lg:gap-12">
      <aside className="lg:sticky lg:top-20 lg:h-fit lg:w-44 lg:shrink-0">
        <div className="mb-3 flex items-center gap-2 text-xs text-white/40">
          <Link className="hover:text-white/70" href={`/app/p/${slug}`}>
            ← Board
          </Link>
        </div>
        <h2 className="mb-4 text-sm font-medium text-white">Settings</h2>
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {SECTIONS.map((s) => (
            <a
              className={cn(segmentVariants({ size: "sm" }), "justify-start")}
              href={`#${s.id}`}
              key={s.id}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-10">
        <header>
          <PageTitle>{project.name}</PageTitle>
          <p className="text-sm text-white/70">Project settings</p>
        </header>

        <GeneralSection
          canWrite={canWrite}
          projectId={project.id}
          slug={slug}
        />
        <AiContextSection
          canWrite={canWrite}
          projectId={project.id}
          slug={slug}
        />
        <MembersSection isOwner={isOwner} projectId={project.id} slug={slug} />
        <SharingSection boardId={project.boardId} isOwner={isOwner} />
        <NotificationsSection projectId={project.id} />
        <DangerZoneSection
          isOwner={isOwner}
          projectId={project.id}
          projectName={project.name}
        />

        <p className="border-t border-white/10 pt-6 text-xs text-white/40">
          Beyond the browser:{" "}
          <Link
            className="underline underline-offset-2 transition hover:text-white/70"
            href="/docs/mcp"
          >
            connect an AI agent
          </Link>{" "}
          over MCP, or{" "}
          <Link
            className="underline underline-offset-2 transition hover:text-white/70"
            href="/docs/focus"
          >
            pair the Focus app
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
