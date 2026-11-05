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
import { Button } from "@/components/ui/button";
import { Dot } from "@/components/ui/badge";
import { DEFAULT_PROJECT_COLOR } from "@/lib/palette";
import { api } from "@/trpc/react";

const PROJECT_SWITCHER_LIMIT = 9;

export function ProjectInfo() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const requestCreateProject = useAppShell((s) => s.requestCreateProject);
  const project = api.project.bySlug.useQuery({ slug }).data;
  const projects = api.project.list.useQuery().data ?? [];
  const switchableProjects = projects
    .filter((project) => project.status === "active")
    .slice(0, PROJECT_SWITCHER_LIMIT);

  if (!project) return null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Switch project"
            className="group h-auto min-w-0 gap-2 px-1.5 py-1"
            type="button"
            variant="property"
          >
            <Dot color={project.color ?? DEFAULT_PROJECT_COLOR} size="md" />
            <h1 className="truncate text-sm font-medium text-white">
              {project.name}
            </h1>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <div className="px-2 py-1 text-xs text-white/40">Switch project</div>
          {switchableProjects.map((p) => {
            const active = p.slug === slug;
            return (
              <DropdownMenuItem asChild key={p.id}>
                <Link
                  className="flex items-center gap-2"
                  href={`/app/p/${p.slug}`}
                >
                  <Dot color={p.color ?? DEFAULT_PROJECT_COLOR} />
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
    </div>
  );
}
