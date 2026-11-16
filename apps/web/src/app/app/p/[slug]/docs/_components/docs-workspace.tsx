"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";
import { AskDocsPanel } from "./ask-docs-panel";
import { DocsHome } from "./docs-home";
import { DocsTree } from "./docs-tree";
import { DocumentView } from "./document-view";
import { MovePageDialog } from "./move-page-dialog";
import { taskBoardHref } from "@/lib/task-link";

export function DocsWorkspace({
  projectId,
  slug,
  canWrite,
  initialDocumentId,
}: {
  projectId: string;
  slug: string;
  canWrite: boolean;
  initialDocumentId?: string;
}) {
  const router = useRouter();
  const documents = api.document.list.useQuery({ projectId });
  const recent = api.document.recent.useQuery({ projectId, limit: 6 });
  const context = api.document.authoringContext.useQuery({ projectId });
  const [query, setQuery] = useState("");
  const [moveId, setMoveId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim());
  const search = api.document.search.useQuery(
    { projectId, query: deferredQuery, limit: 20 },
    { enabled: deferredQuery.length > 0 },
  );
  const utils = api.useUtils();

  const create = api.document.create.useMutation({
    onSuccess: async (document) => {
      await Promise.all([
        utils.document.list.invalidate({ projectId }),
        utils.document.recent.invalidate({ projectId, limit: 6 }),
      ]);
      router.push(`/app/p/${slug}/docs/${document.id}?edit=1`);
    },
    onError: (error) =>
      toastManager.add({ type: "error", title: error.message }),
  });
  const createPage = (parentId: string | null) =>
    create.mutate({ projectId, parentId, title: "Untitled" });

  const ticketItems = useMemo(
    () =>
      (context.data?.tickets ?? []).map((ticket) => ({
        ...ticket,
        assignee: ticket.assignee ?? null,
        href: taskBoardHref(slug, ticket.number),
      })),
    [context.data?.tickets, slug],
  );
  const list = documents.data ?? [];

  return (
    // phones: main is the scroller so the sticky header stays put
    <main className="bg-background relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto md:flex-row md:overflow-hidden">
      <DocsTree
        activeId={initialDocumentId}
        canWrite={canWrite}
        creating={create.isPending}
        documents={list}
        onCreate={createPage}
        onMove={setMoveId}
        query={query}
        searchResults={deferredQuery ? (search.data ?? []) : null}
        setQuery={setQuery}
        slug={slug}
      />

      <ScrollArea className="min-w-0 max-md:flex-none md:flex-1" render={<section />}>
        {initialDocumentId ? (
          <DocumentView
            canWrite={canWrite}
            documentId={initialDocumentId}
            documents={list}
            members={context.data?.members ?? []}
            onCreateChild={() => createPage(initialDocumentId)}
            onMove={() => setMoveId(initialDocumentId)}
            projectId={projectId}
            slug={slug}
            tickets={ticketItems}
          />
        ) : (
          <DocsHome
            canWrite={canWrite}
            creating={create.isPending}
            hasDocuments={list.length > 0}
            loading={recent.isLoading}
            onCreate={() => createPage(null)}
            recent={recent.data ?? []}
            slug={slug}
          />
        )}
      </ScrollArea>

      <AskDocsPanel
        currentDocumentId={initialDocumentId}
        disabled={list.length === 0}
        projectId={projectId}
        slug={slug}
      />
      <MovePageDialog
        documentId={moveId}
        documents={list}
        onClose={() => setMoveId(null)}
        projectId={projectId}
      />
    </main>
  );
}
