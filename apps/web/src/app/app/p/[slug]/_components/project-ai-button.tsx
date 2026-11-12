"use client";

import { SparklesIcon } from "lucide-react";
import { useParams } from "next/navigation";

import { useAppShell } from "@/components/keybinds/shell-store";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
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
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Draft tasks with AI"
            onClick={() => requestAiImport()}
            size="sm"
            variant="outline"
          />
        }
      >
        <SparklesIcon aria-hidden="true" className="text-ai-foreground" />
        <span className="max-sm:hidden">Draft with AI</span>
      </TooltipTrigger>
      <TooltipPopup>
        Draft tasks from a message <Kbd>⇧V</Kbd>
      </TooltipPopup>
    </Tooltip>
  );
}
