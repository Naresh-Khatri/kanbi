"use client";

import { useParams } from "next/navigation";

import { api } from "@/trpc/react";

export function ProjectInvitesBadge() {
  const { slug } = useParams<{ slug: string }>();
  const project = api.project.bySlug.useQuery({ slug }).data;
  const board = api.board.get.useQuery(
    { boardId: project?.boardId ?? "" },
    { enabled: !!project?.boardId },
  ).data;
  const canAdmin = board?.access.canAdmin ?? false;

  const invites = api.project.listInvites.useQuery(
    { projectId: project?.id ?? "" },
    { enabled: canAdmin && !!project?.id },
  ).data ?? [];
  const pending = invites.filter((i) => !i.acceptedAt).length;

  if (!canAdmin || pending === 0) return null;

  return (
    <span
      className="rounded-full bg-amber-400/10 px-2 py-0.5 text-amber-300 text-xs"
      title={`${pending} pending invite${pending === 1 ? "" : "s"}`}
    >
      {pending} pending
    </span>
  );
}
