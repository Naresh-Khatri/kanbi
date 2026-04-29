"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { Section } from "./section";

export function DangerZoneSection({
  projectId,
  projectName,
  isOwner,
}: {
  projectId: string;
  projectName: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const leave = api.project.leave.useMutation({
    onSuccess: async () => {
      toast.success("Left project");
      await utils.project.list.invalidate();
      router.push("/app");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Section
      description="Irreversible actions. Be careful."
      id="danger"
      title="Danger zone"
      tone="danger"
    >
      <div className="flex flex-col gap-4">
        {!isOwner ? (
          <Row
            action={
              <Button
                disabled={leave.isPending}
                onClick={() => {
                  if (
                    confirm(`Leave ${projectName}? You'll lose access to this project.`)
                  ) {
                    leave.mutate({ projectId });
                  }
                }}
                size="sm"
                variant="outline"
              >
                {leave.isPending ? "Leaving…" : "Leave project"}
              </Button>
            }
            description="Remove yourself from this project. You can rejoin only if re-invited."
            title="Leave project"
          />
        ) : null}

        {isOwner ? (
          <Row
            action={
              <Button
                onClick={() => setDeleteOpen(true)}
                size="sm"
                variant="destructive"
              >
                Delete project
              </Button>
            }
            description="Permanently delete this project, its board, and everything inside it."
            title="Delete project"
          />
        ) : null}
      </div>

      <DeleteProjectDialog
        onDeleted={() => router.push("/app")}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        projectId={projectId}
        projectName={projectName}
      />
    </Section>
  );
}

function Row({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-md border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center">
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="text-xs text-white/60">{description}</div>
      </div>
      {action}
    </div>
  );
}
