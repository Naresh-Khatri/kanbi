"use client";

import { useEffect } from "react";

import { CardPanel } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";
import { Section } from "./section";

export function AgentDisclosureSection({
  projectId,
  slug,
}: {
  projectId: string;
  slug: string;
}) {
  const utils = api.useUtils();
  const project = api.project.bySlug.useQuery({ slug }).data;
  const update = api.project.update.useMutation({
    onSuccess: () => utils.project.bySlug.invalidate({ slug }),
    onError: (err) => toastManager.add({ type: "error", title: err.message }),
  });
  // section mounts after the query -> browser hash scroll already missed it
  useEffect(() => {
    if (project && window.location.hash === "#agents")
      document.getElementById("agents")?.scrollIntoView({ block: "start" });
  }, [project]);
  if (!project) return null;

  const checked =
    update.isPending && update.variables.discloseAgents !== undefined
      ? update.variables.discloseAgents
      : project.discloseAgents;

  return (
    <Section
      description="Only you see this setting."
      id="agents"
      title="Agent disclosure"
    >
      <CardPanel>
        <Label className="has-data-checked:bg-accent/50 flex items-center justify-between gap-6 rounded-lg border p-4">
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              Show teammates when you used an agent
            </span>
            <span className="text-muted-foreground text-xs font-normal">
              When off, work your agents do over MCP looks like yours to
              everyone else: no &ldquo;via agent&rdquo; in activity, comments or
              update badges. You always see it, and it&apos;s recorded either
              way.
            </span>
          </span>
          <Switch
            checked={checked}
            disabled={update.isPending}
            onCheckedChange={(next) =>
              update.mutate({ projectId, discloseAgents: next })
            }
          />
        </Label>
      </CardPanel>
    </Section>
  );
}
