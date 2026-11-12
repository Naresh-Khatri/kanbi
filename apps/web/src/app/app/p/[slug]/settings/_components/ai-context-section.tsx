"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";
import { Section } from "./section";
import { SectionFooter } from "./section-footer";

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
      toastManager.add({ type: "success", title: "AI context saved" });
      await utils.project.bySlug.invalidate({ slug });
    },
    onError: (err) => toastManager.add({ type: "error", title: err.message }),
  });

  const dirty =
    !!project &&
    (systemPrompt.trim() || null) !== (project.systemPrompt ?? null);

  return (
    <Section
      description="Extra context handed to the task drafter: what this project is, who it's for, how you like tasks framed."
      id="ai"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canWrite) return;
        update.mutate({
          projectId,
          systemPrompt: systemPrompt.trim() ? systemPrompt.trim() : null,
        });
      }}
      title="AI context"
    >
      <CardPanel>
        <Field disabled={!canWrite} name="systemPrompt">
          <FieldLabel>System prompt</FieldLabel>
          <Textarea
            maxLength={4000}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="e.g. SaaS for dentists. Common issues: appointments, payments, patient records. Triage aggressively."
            rows={8}
            value={systemPrompt}
          />
          <FieldDescription>
            Used when AI drafts tasks here, and shared with agents connected
            over MCP.
          </FieldDescription>
        </Field>
      </CardPanel>
      <SectionFooter>
        <Button
          disabled={!canWrite || !dirty}
          loading={update.isPending}
          size="sm"
          type="submit"
        >
          Save context
        </Button>
      </SectionFooter>
    </Section>
  );
}
