"use client";

import Link from "next/link";

import { api } from "@/trpc/react";
import { AiContextSection } from "./ai-context-section";
import { DangerZoneSection } from "./danger-zone-section";
import { GeneralSection } from "./general-section";
import { MembersSection } from "./members-section";
import { SharingSection } from "./sharing-section";

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "ai", label: "AI context" },
  { id: "members", label: "Members" },
  { id: "sharing", label: "Sharing" },
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
        <div className="mb-3 flex items-center gap-2 text-xs text-white/50">
          <Link
            className="hover:text-white/80"
            href={`/app/p/${slug}`}
          >
            ← Board
          </Link>
        </div>
        <h2 className="mb-4 text-sm font-medium text-white/80">Settings</h2>
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {SECTIONS.map((s) => (
            <a
              className="rounded-md px-2 py-1.5 text-sm whitespace-nowrap text-white/60 transition hover:bg-white/5 hover:text-white"
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
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-white/60">Project settings</p>
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
        <MembersSection
          isOwner={isOwner}
          projectId={project.id}
          slug={slug}
        />
        <SharingSection
          boardId={project.boardId}
          isOwner={isOwner}
        />
        <DangerZoneSection
          isOwner={isOwner}
          projectId={project.id}
          projectName={project.name}
        />
      </div>
    </div>
  );
}
