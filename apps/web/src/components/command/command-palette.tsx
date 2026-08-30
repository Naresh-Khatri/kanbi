"use client";

import { Command } from "cmdk";
import {
  ArrowRight,
  Bot,
  FileText,
  Layers,
  ListTodo,
  Plus,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useRecentProjects } from "@/components/keybinds/recents-store";
import { useAppShell } from "@/components/keybinds/shell-store";
import { api } from "@/trpc/react";

export function CommandPalette() {
  const router = useRouter();
  const {
    paletteOpen,
    setPaletteOpen,
    requestCreateTask,
    requestCreateProject,
    requestAiImport,
  } = useAppShell();
  const [query, setQuery] = useState("");

  const projects = api.project.list.useQuery(undefined, {
    enabled: paletteOpen,
  });
  const recentSlugs = useRecentProjects((s) => s.slugs);

  // recents-first, then rest in server order (active-first, most-recently-active first)
  const orderedProjects = useMemo(() => {
    const all = projects.data ?? [];
    const bySlug = new Map(all.map((p) => [p.slug, p]));
    const recent = recentSlugs
      .map((slug) => bySlug.get(slug))
      .filter((p) => p !== undefined);
    const recentSlugSet = new Set(recent.map((p) => p.slug));
    return [...recent, ...all.filter((p) => !recentSlugSet.has(p.slug))];
  }, [projects.data, recentSlugs]);

  // jump-shortcut numbers, keyed by slug: first 9 active projects in server order
  const jumpNumberBySlug = useMemo(() => {
    const active = (projects.data ?? []).filter((p) => p.status === "active");
    return new Map(active.slice(0, 9).map((p, i) => [p.slug, i + 1]));
  }, [projects.data]);

  const trimmed = query.trim();
  const taskSearch = api.task.search.useQuery(
    { query: trimmed },
    { enabled: paletteOpen && trimmed.length >= 2 },
  );
  const documentSearch = api.document.search.useQuery(
    { query: trimmed, limit: 8 },
    { enabled: paletteOpen && trimmed.length >= 2 },
  );

  useEffect(() => {
    if (!paletteOpen) setQuery("");
  }, [paletteOpen]);

  function go(run: () => void) {
    setPaletteOpen(false);
    run();
  }

  if (!paletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[18vh] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setPaletteOpen(false);
      }}
    >
      <Command
        className="w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-[#0f1016] text-white shadow-2xl"
        label="Command palette"
      >
        <Command.Input
          autoFocus
          className="h-12 w-full bg-transparent px-4 text-sm outline-none placeholder:text-white/40"
          onValueChange={setQuery}
          placeholder="Type a command or search projects, tasks, and docs…"
          value={query}
        />
        <Command.List className="max-h-[50vh] overflow-y-auto border-t border-white/5 py-1">
          <Command.Empty className="px-4 py-6 text-center text-sm text-white/50">
            No results.
          </Command.Empty>
          <Command.Group
            className="px-2 py-1 text-xs tracking-wide text-white/40 uppercase"
            heading="Actions"
          >
            <PaletteItem
              icon={<Plus className="h-4 w-4" />}
              onSelect={() => go(() => requestCreateProject())}
              value="new project"
            >
              New project
            </PaletteItem>
            <PaletteItem
              icon={<Plus className="h-4 w-4" />}
              onSelect={() => go(() => requestCreateTask())}
              value="new task"
            >
              New task on current board
            </PaletteItem>
            <PaletteItem
              icon={<Sparkles className="h-4 w-4" />}
              onSelect={() => go(() => requestAiImport())}
              value="ai import tasks client message"
            >
              AI: Import tasks from a message
            </PaletteItem>
            <PaletteItem
              icon={<ArrowRight className="h-4 w-4" />}
              onSelect={() => go(() => router.push("/app"))}
              value="dashboard"
            >
              Go to dashboard
            </PaletteItem>
            <PaletteItem
              icon={<Bot className="h-4 w-4" />}
              onSelect={() => go(() => router.push("/docs/mcp"))}
              value="connect agent ai mcp integration codex claude grok"
            >
              Connect an AI agent
            </PaletteItem>
          </Command.Group>

          {orderedProjects.length > 0 ? (
            <Command.Group
              className="px-2 py-1 text-xs tracking-wide text-white/40 uppercase"
              heading="Projects"
            >
              {orderedProjects.map((p) => (
                <PaletteItem
                  hint={jumpNumberBySlug.get(p.slug)}
                  icon={<Layers className="h-4 w-4" />}
                  key={p.id}
                  onSelect={() => go(() => router.push(`/app/p/${p.slug}`))}
                  value={`project ${p.name} ${p.slug}`}
                >
                  <span
                    className={
                      p.status === "on_hold" ? "text-white/50" : undefined
                    }
                  >
                    {p.name}
                  </span>
                </PaletteItem>
              ))}
            </Command.Group>
          ) : null}

          {taskSearch.data && taskSearch.data.length > 0 ? (
            <Command.Group
              className="px-2 py-1 text-xs tracking-wide text-white/40 uppercase"
              heading="Tasks"
            >
              {taskSearch.data.map((t) => (
                <PaletteItem
                  icon={<ListTodo className="h-4 w-4" />}
                  key={t.id}
                  onSelect={() =>
                    go(() =>
                      router.push(`/app/p/${t.projectSlug}?task=${t.id}`),
                    )
                  }
                  value={`task ${t.projectKey}-${t.number} ${t.title} ${t.projectName} ${t.id}`}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="shrink-0 font-mono text-xs text-white/40">
                      {t.projectKey}-{t.number}
                    </span>
                    <span className="truncate">{t.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-white/40">
                      {t.projectName}
                    </span>
                  </span>
                </PaletteItem>
              ))}
            </Command.Group>
          ) : null}

          {documentSearch.data && documentSearch.data.length > 0 ? (
            <Command.Group
              className="px-2 py-1 text-xs tracking-wide text-white/40 uppercase"
              heading="Docs"
            >
              {documentSearch.data.map((document) => (
                <PaletteItem
                  icon={<FileText className="h-4 w-4" />}
                  key={document.id}
                  onSelect={() =>
                    go(() =>
                      router.push(
                        `/app/p/${document.projectSlug}/docs/${document.id}`,
                      ),
                    )
                  }
                  value={`document doc page ${document.title} ${document.projectName}`}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate">{document.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-white/40">
                      {document.projectName}
                    </span>
                  </span>
                </PaletteItem>
              ))}
            </Command.Group>
          ) : null}
        </Command.List>
      </Command>
    </div>
  );
}

function PaletteItem({
  icon,
  children,
  value,
  onSelect,
  hint,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  value: string;
  onSelect: () => void;
  hint?: number;
}) {
  return (
    <Command.Item
      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-white/10"
      onSelect={onSelect}
      value={value}
    >
      <span className="text-white/60">{icon}</span>
      {children}
      {hint ? (
        <span className="ml-auto shrink-0 text-xs text-white/40">{hint}</span>
      ) : null}
    </Command.Item>
  );
}
