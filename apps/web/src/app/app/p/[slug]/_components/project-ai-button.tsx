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
      className="group inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 text-sm text-white/80 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/30"
      onClick={() => requestAiImport()}
      title="Draft tasks from a message (Shift+V)"
      type="button"
    >
      <Sparkles className="h-3.5 w-3.5 text-white/70 group-hover:text-white" />
      <span className="hidden sm:inline">Draft with AI</span>
      <kbd className="hidden rounded border border-white/15 bg-white/10 px-1 font-sans text-[10px] text-white/50 sm:inline">
        ⇧V
      </kbd>
    </button>
  );
}
