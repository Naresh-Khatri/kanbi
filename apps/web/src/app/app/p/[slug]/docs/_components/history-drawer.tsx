"use client";

import { formatDateTime, formatRelative } from "@kanbi/shared";
import { HistoryIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";

import { RichTextContent } from "@/components/rich-text/editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toastManager } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export function HistoryDrawer({
  open,
  onOpenChange,
  projectId,
  documentId,
  currentVersion,
  canWrite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  documentId: string;
  currentVersion: number;
  canWrite: boolean;
}) {
  const utils = api.useUtils();
  const history = api.document.history.useQuery(
    { projectId, documentId, limit: 50 },
    { enabled: open },
  );
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const revision = api.document.revision.useQuery(
    { projectId, documentId, version: selectedVersion ?? currentVersion },
    { enabled: open && selectedVersion !== null },
  );
  const restore = api.document.restore.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.document.get.invalidate({ projectId, documentId }),
        utils.document.history.invalidate({ projectId, documentId, limit: 50 }),
        utils.document.list.invalidate({ projectId }),
        utils.document.linkedToTask.invalidate(),
      ]);
      setSelectedVersion(null);
      onOpenChange(false);
      toastManager.add({
        type: "success",
        title: "Version restored",
        description: "It's now the latest revision.",
      });
    },
    onError: (error) =>
      toastManager.add({ type: "error", title: error.message }),
  });

  return (
    <Drawer onOpenChange={onOpenChange} open={open} position="right">
      <DrawerPopup className="max-w-3xl" showCloseButton>
        <DrawerHeader>
          <DrawerTitle>Page history</DrawerTitle>
          <DrawerDescription>
            Edits are grouped into one checkpoint per editing session.
          </DrawerDescription>
        </DrawerHeader>
        <div className="grid min-h-0 flex-1 border-t sm:grid-cols-[13rem_1fr]">
          <ScrollArea className="max-h-48 border-b sm:max-h-none sm:border-e sm:border-b-0">
            <ul aria-label="Versions" className="flex flex-col gap-px p-2">
              {history.isLoading
                ? Array.from({ length: 4 }, (_, i) => (
                    <li className="px-2 py-1.5" key={i}>
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="mt-1.5 h-3 w-28" />
                    </li>
                  ))
                : history.data?.map((item) => {
                    const selected = selectedVersion === item.version;
                    return (
                      <li key={item.id}>
                        <button
                          aria-pressed={selected}
                          className={cn(
                            "hover:bg-accent focus-visible:ring-ring flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-start text-sm transition-colors outline-none focus-visible:ring-2",
                            selected && "bg-accent",
                          )}
                          onClick={() => setSelectedVersion(item.version)}
                          type="button"
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            {formatRelative(item.createdAt)}
                            {item.version === currentVersion ? (
                              <Badge size="sm" variant="secondary">
                                Current
                              </Badge>
                            ) : null}
                          </span>
                          <span
                            className="text-muted-foreground text-xs"
                            title={formatDateTime(item.createdAt)}
                          >
                            {item.editorName}
                          </span>
                        </button>
                      </li>
                    );
                  })}
            </ul>
          </ScrollArea>
          <DrawerPanel className="min-w-0">
            {selectedVersion && revision.data ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3 border-b pb-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">
                      {revision.data.title}
                    </h3>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {formatDateTime(revision.data.createdAt)} by{" "}
                      {revision.data.editorName}
                    </p>
                  </div>
                  {canWrite && selectedVersion !== currentVersion ? (
                    <Button
                      loading={restore.isPending}
                      onClick={() =>
                        restore.mutate({
                          projectId,
                          documentId,
                          version: selectedVersion,
                          expectedVersion: currentVersion,
                        })
                      }
                      size="sm"
                      variant="outline"
                    >
                      <RotateCcwIcon aria-hidden="true" />
                      Restore
                    </Button>
                  ) : null}
                </div>
                <RichTextContent value={revision.data.body} />
              </div>
            ) : selectedVersion && revision.isLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : (
              <Empty className="md:py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HistoryIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>Pick a version</EmptyTitle>
                  <EmptyDescription>
                    Select a checkpoint on the left to preview it.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </DrawerPanel>
        </div>
      </DrawerPopup>
    </Drawer>
  );
}
