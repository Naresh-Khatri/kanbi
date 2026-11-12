"use client";

import {
  CheckIcon,
  ChevronsUpDownIcon,
  LayoutGridIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useAppShell } from "@/components/keybinds/shell-store";
import { ProjectDot } from "@/components/project-dot";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { api } from "@/trpc/react";

const PROJECT_SWITCHER_LIMIT = 9;

export function ProjectInfo() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const requestCreateProject = useAppShell((s) => s.requestCreateProject);
  const project = api.project.bySlug.useQuery({ slug }).data;
  const projects = api.project.list.useQuery().data ?? [];
  const switchable = projects
    .filter((p) => p.status === "active")
    .slice(0, PROJECT_SWITCHER_LIMIT);

  if (!project) return null;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap gap-1 sm:gap-1">
        <BreadcrumbItem className="min-w-0">
          <Menu>
            <MenuTrigger
              aria-label="Switch project"
              className="text-foreground min-w-0 gap-2 px-2"
              render={<Button size="sm" variant="ghost" />}
            >
              <ProjectDot color={project.color} />
              <h1 className="truncate text-sm font-medium">{project.name}</h1>
              <ChevronsUpDownIcon
                aria-hidden="true"
                className="text-muted-foreground"
              />
            </MenuTrigger>
            <MenuPopup align="start" className="w-64">
              <MenuGroup>
                <MenuGroupLabel>Switch project</MenuGroupLabel>
                {switchable.map((p) => (
                  <MenuLinkItem
                    key={p.id}
                    render={<Link href={`/app/p/${p.slug}`} />}
                  >
                    <span className="flex size-4 items-center justify-center">
                      <ProjectDot color={p.color} />
                    </span>
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.slug === slug ? (
                      <CheckIcon aria-hidden="true" className="ms-auto" />
                    ) : null}
                  </MenuLinkItem>
                ))}
              </MenuGroup>
              <MenuSeparator />
              <MenuLinkItem render={<Link href="/app" />}>
                <LayoutGridIcon aria-hidden="true" /> All projects
              </MenuLinkItem>
              <MenuItem
                onClick={() => {
                  requestCreateProject();
                  router.push("/app");
                }}
              >
                <PlusIcon aria-hidden="true" /> New project
              </MenuItem>
            </MenuPopup>
          </Menu>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
