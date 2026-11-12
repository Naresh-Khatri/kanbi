"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/ui/card";
import { toastManager } from "@/components/ui/toast";
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
  const [leaveOpen, setLeaveOpen] = useState(false);

  const leave = api.project.leave.useMutation({
    onSuccess: async () => {
      toastManager.add({ type: "success", title: "Left project" });
      setLeaveOpen(false);
      await utils.project.list.invalidate();
      router.push("/app");
    },
    onError: (err) => toastManager.add({ type: "error", title: err.message }),
  });

  return (
    <Section
      description="Irreversible actions. Be careful."
      id="danger"
      title="Danger zone"
      tone="danger"
    >
      <CardPanel>
        {isOwner ? (
          <Row
            action={
              <Button
                onClick={() => setDeleteOpen(true)}
                size="sm"
                variant="destructive-outline"
              >
                Delete project
              </Button>
            }
            description="Permanently delete this project, its board, and everything inside it."
            title="Delete project"
          />
        ) : (
          <Row
            action={
              <AlertDialog onOpenChange={setLeaveOpen} open={leaveOpen}>
                <AlertDialogTrigger
                  render={<Button size="sm" variant="destructive-outline" />}
                >
                  Leave project
                </AlertDialogTrigger>
                <AlertDialogPopup>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave {projectName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You&apos;ll lose access to this project. You can rejoin
                      only if re-invited.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="ghost" />}>
                      Cancel
                    </AlertDialogClose>
                    <Button
                      loading={leave.isPending}
                      onClick={() => leave.mutate({ projectId })}
                      variant="destructive"
                    >
                      Leave project
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogPopup>
              </AlertDialog>
            }
            description="Remove yourself from this project. You can rejoin only if re-invited."
            title="Leave project"
          />
        )}
      </CardPanel>

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
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-muted-foreground text-xs">{description}</div>
      </div>
      {action}
    </div>
  );
}
