"use client";

import {
  ArrowRightIcon,
  BotIcon,
  FileTextIcon,
  FlagIcon,
  ListTodoIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useRecentProjects } from "@/components/keybinds/recents-store";
import { useAppShell } from "@/components/keybinds/shell-store";
import { ProjectDot } from "@/components/project-dot";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { taskBoardHref } from "@/lib/task-link";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type PaletteEntry = {
  id: string;
  label: string;
  keywords: string;
  icon: React.ReactNode;
  run: () => void;
  // remote search hits already matched server-side -> skip local filter
  remote?: boolean;
  prefix?: string;
  meta?: string;
  shortcut?: number;
  muted?: boolean;
};

type PaletteGroup = { value: string; items: PaletteEntry[] };

function matches(entry: PaletteEntry, tokens: string[]) {
  if (entry.remote || tokens.length === 0) return true;
  const hay = `${entry.label} ${entry.keywords}`.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

export function CommandPalette() {
  const router = useRouter();
  const {
    paletteOpen,
    setPaletteOpen,
    requestCreateTask,
    requestCreateProject,
    requestAiImport,
    requestMilestoneMove,
    milestoneMoveAvailable,
    requestCreateDoc,
    docCreateAvailable,
  } = useAppShell();
  const [query, setQuery] = useState("");

  const projects = api.project.list.useQuery(undefined, {
    enabled: paletteOpen,
  });
  const recentSlugs = useRecentProjects((s) => s.slugs);

  // recents-first, then rest in server order (active-first, most-recently-active first)
  const orderedProjects = useMemo(() => {
    const all = (projects.data ?? []).filter((p) => p.status !== "archived");
    const bySlug = new Map(all.map((p) => [p.slug, p]));
    const recent = recentSlugs
      .map((slug) => bySlug.get(slug))
      .filter((p) => p !== undefined);
    const recentSlugSet = new Set(recent.map((p) => p.slug));
    return [...recent, ...all.filter((p) => !recentSlugSet.has(p.slug))];
  }, [projects.data, recentSlugs]);

  // jump-shortcut numbers: first 9 active projects in server order
  const jumpNumberBySlug = useMemo(() => {
    const active = (projects.data ?? []).filter((p) => p.status === "active");
    return new Map(active.slice(0, 9).map((p, i) => [p.slug, i + 1]));
  }, [projects.data]);

  const trimmed = query.trim();
  const searching = paletteOpen && trimmed.length >= 2;
  const taskSearch = api.task.search.useQuery(
    { query: trimmed },
    { enabled: searching },
  );
  const documentSearch = api.document.search.useQuery(
    { query: trimmed, limit: 8 },
    { enabled: searching },
  );

  useEffect(() => {
    if (!paletteOpen) setQuery("");
  }, [paletteOpen]);

  const groups = useMemo<PaletteGroup[]>(() => {
    const go = (run: () => void) => () => {
      setPaletteOpen(false);
      run();
    };
    const push = (href: string) => go(() => router.push(href));

    const actions: PaletteEntry[] = [
      {
        id: "new-project",
        label: "New project",
        keywords: "create",
        icon: <PlusIcon />,
        run: go(requestCreateProject),
      },
      ...(docCreateAvailable
        ? [
            {
              id: "new-page",
              label: "New page",
              keywords: "create doc document",
              icon: <FileTextIcon />,
              run: go(requestCreateDoc),
            },
          ]
        : []),
      {
        id: "new-task",
        label: "New task on current board",
        keywords: "create",
        icon: <PlusIcon />,
        run: go(requestCreateTask),
      },
      ...(milestoneMoveAvailable
        ? [
            {
              id: "move-milestone",
              label: "Move to milestone…",
              keywords: "milestone release version sprint task",
              icon: <FlagIcon />,
              run: go(requestMilestoneMove),
            },
          ]
        : []),
      {
        id: "ai-import",
        label: "Draft tasks from a message",
        keywords: "ai import client message",
        icon: <SparklesIcon />,
        run: go(requestAiImport),
      },
      {
        id: "home",
        label: "Go to Home",
        keywords: "dashboard projects",
        icon: <ArrowRightIcon />,
        run: push("/app"),
      },
      {
        id: "agent",
        label: "Connect an AI agent",
        keywords: "mcp integration codex claude grok",
        icon: <BotIcon />,
        run: push("/docs/mcp"),
      },
    ];

    const projectEntries: PaletteEntry[] = orderedProjects.map((p) => ({
      id: `project-${p.id}`,
      label: p.name,
      keywords: `project ${p.slug}`,
      icon: (
        <span className="flex size-4 items-center justify-center">
          <ProjectDot color={p.color} />
        </span>
      ),
      run: push(`/app/p/${p.slug}`),
      shortcut: jumpNumberBySlug.get(p.slug),
      muted: p.status === "on_hold",
    }));

    const taskEntries: PaletteEntry[] = searching
      ? (taskSearch.data ?? []).map((t) => ({
          id: `task-${t.id}`,
          label: t.title,
          keywords: "",
          icon: <ListTodoIcon />,
          run: push(taskBoardHref(t.projectSlug, t.number)),
          remote: true,
          prefix: `${t.projectKey}-${t.number}`,
          meta: t.projectName,
        }))
      : [];

    const docEntries: PaletteEntry[] = searching
      ? (documentSearch.data ?? []).map((d) => ({
          id: `doc-${d.id}`,
          label: d.title,
          keywords: "",
          icon: <FileTextIcon />,
          run: push(`/app/p/${d.projectSlug}/docs/${d.id}`),
          remote: true,
          meta: d.projectName,
        }))
      : [];

    return [
      { value: "Actions", items: actions },
      { value: "Projects", items: projectEntries },
      { value: "Tasks", items: taskEntries },
      { value: "Docs", items: docEntries },
    ];
  }, [
    orderedProjects,
    jumpNumberBySlug,
    searching,
    taskSearch.data,
    documentSearch.data,
    router,
    setPaletteOpen,
    requestCreateProject,
    requestCreateTask,
    requestAiImport,
    requestMilestoneMove,
    milestoneMoveAvailable,
    requestCreateDoc,
    docCreateAvailable,
  ]);

  const filtered = useMemo(() => {
    const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    return groups
      .map((g) => ({ ...g, items: g.items.filter((e) => matches(e, tokens)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, trimmed]);

  return (
    <CommandDialog onOpenChange={setPaletteOpen} open={paletteOpen}>
      <CommandDialogPopup aria-label="Command palette">
        <Command
          filteredItems={filtered}
          items={groups}
          itemToStringValue={(item) => (item as PaletteEntry).label}
          mode="none"
          onValueChange={setQuery}
          value={query}
        >
          <CommandInput placeholder="Search projects, tasks, docs or run a command…" />
          <CommandPanel>
            <CommandEmpty>
              {searching && (taskSearch.isFetching || documentSearch.isFetching)
                ? "Searching…"
                : "No results."}
            </CommandEmpty>
            <CommandList>
              {(group: PaletteGroup) => (
                <CommandGroup items={group.items} key={group.value}>
                  <CommandGroupLabel>{group.value}</CommandGroupLabel>
                  <CommandCollection>
                    {(item: PaletteEntry) => (
                      <CommandItem
                        className="[&_svg]:text-muted-foreground gap-2.5 [&_svg]:size-4 [&_svg]:shrink-0"
                        key={item.id}
                        onClick={item.run}
                        value={item}
                      >
                        {item.icon}
                        {item.prefix ? (
                          <span className="text-muted-foreground shrink-0 font-mono text-xs">
                            {item.prefix}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate",
                            item.muted && "text-muted-foreground",
                          )}
                        >
                          {item.label}
                        </span>
                        {item.meta ? (
                          <span className="text-muted-foreground max-w-40 shrink-0 truncate text-xs">
                            {item.meta}
                          </span>
                        ) : null}
                        {item.shortcut ? (
                          <CommandShortcut>⌥{item.shortcut}</CommandShortcut>
                        ) : null}
                      </CommandItem>
                    )}
                  </CommandCollection>
                </CommandGroup>
              )}
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <KbdGroup>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                </KbdGroup>
                Navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd>
                Open
              </span>
            </div>
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              Close
            </span>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
