"use client";

import { useParams } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { api } from "@/trpc/react";

type Role = "owner" | "editor" | "viewer";

export function ProjectMembers() {
  const { slug } = useParams<{ slug: string }>();
  const project = api.project.bySlug.useQuery({ slug }).data;
  const members =
    api.project.members.useQuery(
      { projectId: project?.id ?? "" },
      { enabled: !!project?.id },
    ).data ?? [];

  if (members.length === 0) return null;

  const MAX = 4;
  const shown = members.slice(0, MAX);
  const extra = members.length - shown.length;
  const sorted = [...members].sort((a, b) => {
    const rank = { owner: 0, editor: 1, viewer: 2 } as const;
    const r = rank[a.role as Role] - rank[b.role as Role];
    return r !== 0 ? r : a.name.localeCompare(b.name);
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`${members.length} member${members.length === 1 ? "" : "s"}`}
          className="flex items-center rounded-full outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/30"
          type="button"
        >
          <span className="flex -space-x-1.5">
            {shown.map((m) => (
              <span
                className="rounded-full ring-2 ring-[#0b0b0f]"
                key={m.userId}
                title={`${m.name}${m.role === "owner" ? " (owner)" : ""}`}
              >
                <UserAvatar image={m.image} name={m.name} size={22} />
              </span>
            ))}
            {extra > 0 ? (
              <span
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white/10 text-[10px] text-white/80 ring-2 ring-[#0b0b0f]"
                title={`${extra} more`}
              >
                +{extra}
              </span>
            ) : null}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1 text-white/50 text-xs">
          {members.length} member{members.length === 1 ? "" : "s"}
        </div>
        {sorted.map((m) => (
          <div
            className="flex items-center gap-2 px-2 py-1.5 text-sm"
            key={m.userId}
          >
            <UserAvatar image={m.image} name={m.name} size={24} />
            <span className="flex-1 truncate">{m.name}</span>
            <span className="text-white/50 text-xs capitalize">{m.role}</span>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
