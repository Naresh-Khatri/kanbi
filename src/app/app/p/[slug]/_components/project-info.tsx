"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useAppShell } from "@/components/keybinds/shell-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/trpc/react";

export function ProjectInfo() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const requestCreateProject = useAppShell((s) => s.requestCreateProject);
  const project = api.project.bySlug.useQuery({ slug }).data;
  const projects = api.project.list.useQuery().data ?? [];

  if (!project) return null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Switch project"
            className="group flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/20"
            type="button"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: project.color ?? "#6366f1" }}
            />
            <h1 className="truncate font-medium text-sm text-white">
              {project.name}
            </h1>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-white/40 group-hover:text-white/70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <div className="px-2 py-1 text-white/50 text-xs">
            Switch project
          </div>
          {projects.map((p) => {
            const active = p.slug === slug;
            return (
              <DropdownMenuItem asChild key={p.id}>
                <Link
                  className="flex items-center gap-2"
                  href={`/app/p/${p.slug}`}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: p.color ?? "#6366f1" }}
                  />
                  <span className="flex-1 truncate">{p.name}</span>
                  {active ? (
                    <Check className="h-3.5 w-3.5 text-white/70" />
                  ) : null}
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/app")}>
            All projects
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              requestCreateProject();
              router.push("/app");
            }}
          >
            <Plus className="h-4 w-4" /> New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {project.description ? (
        <span
          className="hidden max-w-[28ch] truncate text-white/50 text-xs md:inline"
          title={project.description}
        >
          — {project.description}
        </span>
      ) : null}
    </div>
  );
}
