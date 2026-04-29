"use client";

import { Command } from "cmdk";
import { ArrowRight, Layers, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
          placeholder="Type a command or search projects…"
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
          </Command.Group>

          {projects.data && projects.data.length > 0 ? (
            <Command.Group
              className="px-2 py-1 text-xs tracking-wide text-white/40 uppercase"
              heading="Projects"
            >
              {projects.data.map((p) => (
                <PaletteItem
                  icon={<Layers className="h-4 w-4" />}
                  key={p.id}
                  onSelect={() => go(() => router.push(`/app/p/${p.slug}`))}
                  value={`project ${p.name} ${p.slug}`}
                >
                  {p.name}
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
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  value: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-white/10"
      onSelect={onSelect}
      value={value}
    >
      <span className="text-white/60">{icon}</span>
      {children}
    </Command.Item>
  );
}
