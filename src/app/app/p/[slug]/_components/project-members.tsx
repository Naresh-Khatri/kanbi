"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

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
  const sorted = [...members].sort((a, b) => {
    const rank = { owner: 0, editor: 1, viewer: 2 } as const;
    const r = rank[a.role as Role] - rank[b.role as Role];
    return r !== 0 ? r : a.name.localeCompare(b.name);
  });
  const shown = sorted.slice(0, MAX);
  const extra = sorted.length - shown.length;

  return (
    <Link
      aria-label={`${members.length} member${members.length === 1 ? "" : "s"} — manage in settings`}
      className="flex items-center rounded-full transition outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/30"
      href={`/app/p/${slug}/settings#members`}
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
    </Link>
  );
}
