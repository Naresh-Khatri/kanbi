"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { invalidateProjectLifecycle } from "@/app/app/_components/invalidate-project-lifecycle";

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
      toast.success("Project restored");
      await invalidateProjectLifecycle(utils);
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  if (currentStatus !== "archived") return null;

  if (!canRestore) {
    return (
      <Badge className="h-8 px-2.5 text-xs">
        <Archive className="h-3.5 w-3.5" /> Archived
      </Badge>
    );
  }

  return (
    <Button
      className="gap-1.5"
      disabled={restore.isPending}
      onClick={() => restore.mutate({ projectId, status: "active" })}
      size="sm"
      type="button"
      variant="toolbar"
    >
      <ArchiveRestore className="h-3.5 w-3.5" />
      {restore.isPending ? "Restoring…" : "Restore project"}
    </Button>
  );
}
