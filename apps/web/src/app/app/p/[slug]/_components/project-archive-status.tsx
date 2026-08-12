"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs text-white/50">
        <Archive className="h-3.5 w-3.5" /> Archived
      </span>
    );
  }

  return (
    <button
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
      disabled={restore.isPending}
      onClick={() => restore.mutate({ projectId, status: "active" })}
      type="button"
    >
      <ArchiveRestore className="h-3.5 w-3.5" />
      {restore.isPending ? "Restoring…" : "Restore project"}
    </button>
  );
}
