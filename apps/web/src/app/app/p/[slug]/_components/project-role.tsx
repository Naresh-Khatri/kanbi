"use client";

import { useParams } from "next/navigation";

import { api } from "@/trpc/react";

type Role = "owner" | "editor" | "viewer";

const STYLES: Record<Role, string> = {
  owner: "bg-violet-400/10 text-violet-300",
  editor: "bg-sky-400/10 text-sky-300",
  viewer: "bg-white/5 text-white/70",
};

export function ProjectRole() {
  const { slug } = useParams<{ slug: string }>();
  const project = api.project.bySlug.useQuery({ slug }).data;
  const board = api.board.get.useQuery(
    { boardId: project?.boardId ?? "" },
    { enabled: !!project?.boardId },
  ).data;

  const role = board?.access.role as Role | undefined;
  if (!role) return null;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs capitalize ${STYLES[role]}`}
    >
      {role}
    </span>
  );
}
