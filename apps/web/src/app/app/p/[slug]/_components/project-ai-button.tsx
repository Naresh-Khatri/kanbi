"use client";

import { Sparkles } from "lucide-react";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
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
    <Button
      aria-label="Draft tasks with AI"
      className="gap-1.5"
      onClick={() => requestAiImport()}
      size="sm"
      title="Draft tasks from a message (Shift+V)"
      type="button"
      variant="toolbar"
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Draft with AI</span>
      <Kbd className="hidden sm:inline" variant="hint">
        ⇧V
      </Kbd>
    </Button>
  );
}
