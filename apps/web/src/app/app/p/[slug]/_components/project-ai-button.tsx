"use client";

import { Sparkles } from "lucide-react";
import { useParams } from "next/navigation";

import { useAppShell } from "@/components/keybinds/shell-store";
import { api } from "@/trpc/react";

export function ProjectAiButton() {
  const { slug } = useParams<{ slug: string }>();
  const requestAiImport = useAppShell((s) => s.requestAiImport);
  const project = api.project.bySlug.useQuery({ slug }).data;
  const board = api.board.get.useQuery(
    { boardId: project?.boardId ?? "" },
    { enabled: !!project?.boardId },
  ).data;

  if (!board?.access.canWrite) return null;

  return (
    <button
      aria-label="Draft tasks with AI"
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 transition hover:border-white/20 hover:text-white"
      onClick={() => requestAiImport()}
      title="Draft tasks from a message (Shift+V)"
      type="button"
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Draft with AI</span>
    </button>
  );
}
