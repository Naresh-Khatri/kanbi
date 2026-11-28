"use client";

import { useRouter } from "next/navigation";

import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";
import { descendantIds, type DocumentList } from "./tree";

const UNDO_WINDOW_MS = 6000;

export type DocActions = {
  remove: (documentId: string) => void;
  duplicate: (documentId: string) => void;
  toggleFavorite: (documentId: string) => void;
  setIcon: (documentId: string, icon: string | null) => void;
  move: (args: {
    documentId: string;
    parentId: string | null;
    beforeId?: string | null;
    afterId?: string | null;
    position: number;
  }) => void;
};

/** Page mutations shared by the tree and the page view; all optimistic on `list`. */
export function useDocActions({
  projectId,
  slug,
  activeId,
}: {
  projectId: string;
  slug: string;
  activeId?: string;
}): DocActions {
  const router = useRouter();
  const utils = api.useUtils();
  const key = { projectId };
  const refresh = () =>
    Promise.all([
      utils.document.list.invalidate(key),
      utils.document.recent.invalidate({ projectId }),
    ]);
  const onError = (error: { message: string }) => {
    toastManager.add({ type: "error", title: error.message });
    void refresh();
  };

  const del = api.document.delete.useMutation({
    onError,
    onSettled: () => {
      void refresh();
      void utils.document.backlinks.invalidate();
    },
  });
  const dup = api.document.duplicate.useMutation({
    onSuccess: async (document) => {
      await refresh();
      router.push(`/app/p/${slug}/docs/${document.id}`);
    },
    onError,
  });
  const fav = api.document.setFavorite.useMutation({ onError });
  const icon = api.document.setIcon.useMutation({
    onError,
    onSuccess: (_, input) =>
      utils.document.get.setData(
        { projectId, documentId: input.documentId },
        (old) => (old ? { ...old, icon: input.icon } : old),
      ),
  });
  const move = api.document.move.useMutation({ onError, onSettled: refresh });

  const patch = (
    documentId: string,
    update: (doc: DocumentList[number]) => Partial<DocumentList[number]>,
  ) =>
    utils.document.list.setData(key, (old) =>
      old?.map((doc) => (doc.id === documentId ? { ...doc, ...update(doc) } : doc)),
    );

  return {
    remove: (documentId) => {
      const snapshot = utils.document.list.getData(key);
      const target = snapshot?.find((doc) => doc.id === documentId);
      if (!snapshot || !target) return;
      void utils.document.list.cancel(key);
      const ids = descendantIds(snapshot, documentId).add(documentId);
      utils.document.list.setData(key, (old) =>
        old?.filter((doc) => !ids.has(doc.id)),
      );
      if (activeId && ids.has(activeId)) router.push(`/app/p/${slug}/docs`);

      let undone = false;
      const commit = setTimeout(() => {
        if (!undone) del.mutate({ projectId, documentId });
      }, UNDO_WINDOW_MS);
      const children = ids.size - 1;
      const toastId = toastManager.add({
        title: `Deleted "${target.title}"`,
        description:
          children > 0
            ? `And ${children} nested page${children === 1 ? "" : "s"}.`
            : undefined,
        timeout: UNDO_WINDOW_MS,
        actionProps: {
          children: "Undo",
          onClick: () => {
            undone = true;
            clearTimeout(commit);
            toastManager.close(toastId);
            utils.document.list.setData(key, (current) => {
              const restored = snapshot.filter((doc) => ids.has(doc.id));
              return [
                ...(current ?? []).filter((doc) => !ids.has(doc.id)),
                ...restored,
              ];
            });
          },
        },
      });
    },
    duplicate: (documentId) => dup.mutate({ projectId, documentId }),
    toggleFavorite: (documentId) => {
      const doc = utils.document.list
        .getData(key)
        ?.find((d) => d.id === documentId);
      const favorite = !doc?.favoritedAt;
      patch(documentId, () => ({ favoritedAt: favorite ? new Date() : null }));
      fav.mutate({ projectId, documentId, favorite });
    },
    setIcon: (documentId, value) => {
      patch(documentId, () => ({ icon: value }));
      icon.mutate({ projectId, documentId, icon: value });
    },
    move: ({ position, ...input }) => {
      void utils.document.list.cancel(key);
      patch(input.documentId, () => ({ parentId: input.parentId, position }));
      move.mutate({ projectId, ...input });
    },
  };
}
