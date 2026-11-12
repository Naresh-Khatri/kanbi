"use client";

import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { invalidateProjectLifecycle } from "@/app/app/_components/invalidate-project-lifecycle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";

export function ProjectArchiveStatus({
  projectId,
  slug,
  status,
  canRestore,
}: {
  projectId: string;
  slug: string;
  status: "active" | "on_hold" | "archived";
  canRestore: boolean;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const currentStatus =
    api.project.bySlug.useQuery({ slug }).data?.status ?? status;
  const restore = api.project.setStatus.useMutation({
    onSuccess: async () => {
      toastManager.add({ type: "success", title: "Project restored" });
      await invalidateProjectLifecycle(utils);
      router.refresh();
    },
    onError: (error) =>
      toastManager.add({
        type: "error",
        title: "Couldn't restore project",
        description: error.message,
      }),
  });

  if (currentStatus !== "archived") return null;

  if (!canRestore) {
    return (
      <Badge variant="outline">
        <ArchiveIcon aria-hidden="true" /> Archived
      </Badge>
    );
  }

  return (
    <Button
      loading={restore.isPending}
      onClick={() => restore.mutate({ projectId, status: "active" })}
      size="sm"
      variant="outline"
    >
      <ArchiveRestoreIcon aria-hidden="true" />
      Restore project
    </Button>
  );
}
