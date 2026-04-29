"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import { Section } from "./section";

export function AiContextSection({
  projectId,
  slug,
  canWrite,
}: {
  projectId: string;
  slug: string;
  canWrite: boolean;
}) {
  const utils = api.useUtils();
  const project = api.project.bySlug.useQuery({ slug }).data;
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    if (!project) return;
    setSystemPrompt(project.systemPrompt ?? "");
  }, [project]);

  const update = api.project.update.useMutation({
    onSuccess: async () => {
      toast.success("AI context saved");
      await utils.project.bySlug.invalidate({ slug });
    },
    onError: (err) => toast.error(err.message),
  });

  const dirty =
    !!project &&
    (systemPrompt.trim() || null) !== (project.systemPrompt ?? null);

  return (
    <Section
      description="Extra context handed to the task drafter — what this project is, who it's for, how you like tasks framed."
      id="ai"
      title="AI context"
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canWrite) return;
          update.mutate({
            projectId,
            systemPrompt: systemPrompt.trim() ? systemPrompt.trim() : null,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-system-prompt">System prompt</Label>
          <Textarea
            disabled={!canWrite}
            id="settings-system-prompt"
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="e.g. SaaS for dentists. Common issues: appointments, payments, patient records. Triage aggressively."
            rows={8}
            value={systemPrompt}
          />
        </div>
        <div className="flex justify-end">
          <Button disabled={!canWrite || !dirty || update.isPending} type="submit">
            {update.isPending ? "Saving…" : "Save context"}
          </Button>
        </div>
      </form>
    </Section>
  );
}
