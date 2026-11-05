"use client";

import { formatDateTime, formatRelative } from "@kanbi/shared";
import {
  ArrowUp,
  BookOpen,
  ChevronRight,
  Clock3,
  FilePlus2,
  FileText,
  FolderInput,
  History,
  Loader2,
  PanelRightClose,
  Pencil,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  RichTextContent,
  RichTextEditor,
} from "@/components/ui/rich-text-editor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, IconTile, SectionLabel } from "@/components/ui/surface";
import { segmentVariants } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

type DocumentList = RouterOutputs["document"]["list"];

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
    onError: (error) => toast.error(error.message),
  });

  const ticketItems = useMemo(
    () =>
      (context.data?.tickets ?? []).map((ticket) => ({
        ...ticket,
        assignee: ticket.assignee ?? null,
        href: `/app/p/${slug}?task=${ticket.id}`,
      })),
    [context.data?.tickets, slug],
  );

  return (
    <main className="bg-canvas min-h-below-header md:h-below-header relative flex flex-col overflow-x-clip md:flex-row md:overflow-hidden">
      <DocsSidebar
        activeId={initialDocumentId}
        canWrite={canWrite}
        creating={create.isPending}
        documents={documents.data ?? []}
        onCreate={(parentId) =>
          create.mutate({ projectId, parentId, title: "Untitled" })
        }
        query={query}
        searchResults={deferredQuery ? (search.data ?? []) : null}
        setQuery={setQuery}
        slug={slug}
      />

      <section className="min-w-0 flex-1 overflow-y-auto">
        {initialDocumentId ? (
          <DocumentSurface
            canWrite={canWrite}
            documentId={initialDocumentId}
            documents={documents.data ?? []}
            members={context.data?.members ?? []}
            onCreateChild={() =>
              create.mutate({
                projectId,
                parentId: initialDocumentId,
                title: "Untitled",
              })
            }
            projectId={projectId}
            slug={slug}
            tickets={ticketItems}
          />
        ) : (
          <DocsHome
            canWrite={canWrite}
            creating={create.isPending}
            hasDocuments={(documents.data?.length ?? 0) > 0}
            onCreate={() =>
              create.mutate({ projectId, parentId: null, title: "Untitled" })
            }
            recent={recent.data ?? []}
            slug={slug}
          />
        )}
      </section>
      <AskDocsChat
        currentDocumentId={initialDocumentId}
        disabled={!documents.data || documents.data.length === 0}
        projectId={projectId}
        slug={slug}
      />
    </main>
  );
}

function DocsSidebar({
  documents,
  slug,
  activeId,
  query,
  setQuery,
  searchResults,
  canWrite,
  creating,
  onCreate,
}: {
  documents: DocumentList;
  slug: string;
  activeId?: string;
  query: string;
  setQuery: (value: string) => void;
  searchResults: RouterOutputs["document"]["search"] | null;
  canWrite: boolean;
  creating: boolean;
  onCreate: (parentId: string | null) => void;
}) {
  const flattened = useMemo(() => flattenDocuments(documents), [documents]);
  return (
    <aside className="flex max-h-72 w-full shrink-0 flex-col border-b border-white/10 bg-white/5 md:max-h-none md:w-64 md:border-r md:border-b-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <SectionLabel>Project knowledge</SectionLabel>
          <h2 className="mt-1 text-sm font-semibold text-white">Docs</h2>
        </div>
        {canWrite ? (
          <Button
            aria-label="New root page"
            disabled={creating}
            onClick={() => onCreate(null)}
            size="icon-sm"
            title="New page"
            type="button"
            variant="quiet"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        ) : null}
      </div>
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <Input
            aria-label="Search docs"
            className="h-8 pl-8 text-xs"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docs"
            value={query}
          />
        </div>
      </div>
      <nav
        aria-label="Document tree"
        className="flex-1 overflow-y-auto px-2 pb-4"
      >
        {searchResults ? (
          searchResults.length > 0 ? (
            searchResults.map((document) => (
              <DocumentLink
                active={document.id === activeId}
                depth={0}
                href={`/app/p/${document.projectSlug}/docs/${document.id}`}
                key={document.id}
                title={document.title}
              />
            ))
          ) : (
            <p className="px-2 py-6 text-center text-xs text-white/40">
              No matching pages
            </p>
          )
        ) : flattened.length > 0 ? (
          flattened.map(({ document, depth }) => (
            <DocumentLink
              active={document.id === activeId}
              depth={depth}
              href={`/app/p/${slug}/docs/${document.id}`}
              key={document.id}
              title={document.title}
            />
          ))
        ) : (
          <p className="px-2 py-6 text-center text-xs leading-relaxed text-white/40">
            Pages you create will form a quiet, shared project index.
          </p>
        )}
      </nav>
    </aside>
  );
}

function AskDocsChat({
  projectId,
  slug,
  currentDocumentId,
  disabled,
}: {
  projectId: string;
  slug: string;
  currentDocumentId?: string;
  disabled: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);
  const ask = api.document.ask.useMutation({
    onError: (error) => toast.error(error.message),
  });

  const submit = () => {
    const trimmed = question.trim();
    if (trimmed.length < 2 || ask.isPending || disabled) return;
    ask.reset();
    setAskedQuestion(trimmed);
    setQuestion("");
    ask.mutate({ projectId, question: trimmed, currentDocumentId });
  };

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {!expanded ? (
        <Button
          asChild
          className="bg-raised fixed right-5 bottom-5 z-40"
          size="sm"
          variant="toolbar"
        >
          <motion.button
            animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
            aria-label="Open Ask Docs"
            exit={{
              opacity: 0,
              transform: reduceMotion
                ? "translateY(0) scale(1)"
                : "translateY(4px) scale(0.97)",
              transition: {
                duration: 0.1,
                ease: [0.23, 1, 0.32, 1],
              },
            }}
            initial={{
              opacity: 0,
              transform: reduceMotion
                ? "translateY(0) scale(1)"
                : "translateY(6px) scale(0.97)",
            }}
            key="ask-docs-trigger"
            onClick={() => setExpanded(true)}
            title="Open Ask Docs"
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            type="button"
            whileTap={{ transform: "translateY(0) scale(0.97)" }}
          >
            <Sparkles className="h-3.5 w-3.5 text-white/40" />
            Ask docs
          </motion.button>
        </Button>
      ) : (
        <motion.aside
          animate={{ opacity: 1, transform: "translateX(0)" }}
          className="bg-canvas flex h-96 w-full shrink-0 flex-col border-t border-white/10 md:h-auto md:w-80 md:border-t-0 md:border-l xl:w-96"
          exit={{
            opacity: 0,
            transform: reduceMotion ? "translateX(0)" : "translateX(16px)",
            transition: {
              duration: 0.16,
              ease: [0.23, 1, 0.32, 1],
            },
          }}
          initial={{
            opacity: 0,
            transform: reduceMotion ? "translateX(0)" : "translateX(24px)",
          }}
          key="ask-docs-panel"
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 px-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-white/40" />
              <h2 className="text-xs font-medium text-white/70">Ask docs</h2>
            </div>
            <div className="flex items-center gap-1">
              {askedQuestion ? (
                <Button
                  aria-label="Clear conversation"
                  onClick={() => {
                    setAskedQuestion(null);
                    ask.reset();
                  }}
                  size="icon-sm"
                  title="Clear conversation"
                  type="button"
                  variant="quiet"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              <Button
                aria-label="Collapse Ask Docs"
                onClick={() => setExpanded(false)}
                size="icon-sm"
                title="Collapse Ask Docs"
                type="button"
                variant="quiet"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </Button>
            </div>
          </header>

          <div
            aria-live="polite"
            className="min-h-0 flex-1 overflow-y-auto p-4"
          >
            {askedQuestion ? (
              <>
                <div className="flex justify-end pl-8">
                  <p className="max-w-[90%] rounded-md bg-white/5 px-3 py-2 text-xs leading-5 text-white/70">
                    {askedQuestion}
                  </p>
                </div>
                <div className="mt-4 flex items-start gap-2.5">
                  <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0 text-white/40" />
                  <div className="min-w-0 flex-1">
                    {ask.isPending ? (
                      <p className="text-xs leading-5 text-white/40">
                        Looking through project docs…
                      </p>
                    ) : ask.data ? (
                      <>
                        <p className="text-sm leading-6 whitespace-pre-wrap text-white/70">
                          {ask.data.answer}
                        </p>
                        {ask.data.citations.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {ask.data.citations.map((citation) => (
                              <Button
                                asChild
                                className="max-w-full"
                                key={citation.documentId}
                                size="xs"
                                variant="toolbar"
                              >
                                <Link
                                  href={`/app/p/${slug}/docs/${citation.documentId}`}
                                >
                                  <FileText className="h-3 w-3 shrink-0 text-white/40" />
                                  <span className="truncate">
                                    {citation.title}
                                  </span>
                                </Link>
                              </Button>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : ask.error ? (
                      <p className="text-xs leading-5 text-white/40">
                        I couldn&apos;t answer that right now. Try again in a
                        moment.
                      </p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-28 flex-col items-center justify-center text-center">
                <Sparkles className="h-4 w-4 text-white/40" />
                <p className="mt-3 max-w-48 text-xs leading-5 text-white/40">
                  {disabled
                    ? "Create a page before asking project docs."
                    : "Ask a question and get an answer grounded in project pages."}
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-white/10 p-3">
            <div className="relative">
              <Textarea
                aria-label="Ask project docs"
                className="max-h-32 resize-none pr-10 text-xs leading-5"
                disabled={disabled || ask.isPending}
                maxLength={500}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder={
                  disabled ? "Create a page to ask docs" : "Ask project docs…"
                }
                rows={3}
                value={question}
              />
              <Button
                aria-label="Ask"
                className="absolute right-1.5 bottom-1.5"
                disabled={
                  disabled || ask.isPending || question.trim().length < 2
                }
                onClick={submit}
                size="icon-sm"
                title="Ask (Enter)"
                type="button"
              >
                {ask.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="text-2xs mt-1.5 px-1 text-white/40">
              Answers cite project pages.
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function DocumentLink({
  href,
  title,
  depth,
  active,
}: {
  href: string;
  title: string;
  depth: number;
  active: boolean;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        segmentVariants({ active, size: "sm" }),
        "group justify-start pr-2",
      )}
      href={href}
      style={{ paddingLeft: `${8 + Math.min(depth, 5) * 14}px` }}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-white/40 group-hover:text-white/70" />
      <span className="truncate">{title}</span>
    </Link>
  );
}

function DocsHome({
  recent,
  slug,
  canWrite,
  hasDocuments,
  creating,
  onCreate,
}: {
  recent: RouterOutputs["document"]["recent"];
  slug: string;
  canWrite: boolean;
  hasDocuments: boolean;
  creating: boolean;
  onCreate: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="mx-auto w-full max-w-4xl px-6 py-12 md:px-12 md:py-16"
      layout={reduceMotion ? false : "position"}
      transition={{
        layout: { duration: 0.22, ease: [0.77, 0, 0.175, 1] },
      }}
    >
      <header className="border-b border-white/10 pb-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <SectionLabel>Shared context</SectionLabel>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Project docs
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">
              Keep decisions, briefs, and runbooks beside the work they explain.
            </p>
          </div>
          {canWrite ? (
            <Button disabled={creating} onClick={onCreate} size="sm">
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FilePlus2 className="h-3.5 w-3.5" />
              )}
              New page
            </Button>
          ) : null}
        </div>
      </header>

      {recent.length > 0 ? (
        <section className="mt-10">
          <SectionLabel as="h2">Recently updated</SectionLabel>
          <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
            {recent.map((document) => (
              <Link
                className="group flex items-center gap-4 py-4 transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
                href={`/app/p/${slug}/docs/${document.id}`}
                key={document.id}
              >
                <IconTile size="sm">
                  <FileText className="h-3.5 w-3.5 text-white/40" />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white group-hover:text-white">
                    {document.title}
                  </p>
                  <p className="mt-0.5 text-xs text-white/40">
                    {document.updatedByName} ·{" "}
                    {formatRelative(document.updatedAt ?? document.createdAt)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/40" />
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <div className="flex min-h-80 flex-col items-center justify-center text-center">
          <IconTile size="lg">
            <BookOpen className="h-5 w-5 text-white/40" />
          </IconTile>
          <h2 className="mt-5 text-base font-medium text-white">
            {hasDocuments
              ? "Nothing updated recently"
              : "Start the project record"}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/40">
            Create one page for the context that should outlive a task or
            meeting.
          </p>
        </div>
      )}
    </motion.div>
  );
}

function DocumentSurface({
  projectId,
  slug,
  documentId,
  documents,
  canWrite,
  members,
  tickets,
  onCreateChild,
}: {
  projectId: string;
  slug: string;
  documentId: string;
  documents: DocumentList;
  canWrite: boolean;
  members: RouterOutputs["document"]["authoringContext"]["members"];
  tickets: RouterOutputs["document"]["authoringContext"]["tickets"] &
    Array<{ href?: string }>;
  onCreateChild: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const document = api.document.get.useQuery({ projectId, documentId });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [conflict, setConflict] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const openedEditParam = useRef(false);

  useEffect(() => {
    if (!document.data) return;
    setTitle(document.data.title);
    setBody(document.data.body);
    setConflict(false);
    if (searchParams.get("edit") === "1" && !openedEditParam.current) {
      openedEditParam.current = true;
      setEditing(canWrite);
      router.replace(`/app/p/${slug}/docs/${documentId}`, { scroll: false });
    }
  }, [canWrite, document.data, documentId, router, searchParams, slug]);

  const dirty =
    !!document.data &&
    (title !== document.data.title || body !== document.data.body);

  const save = api.document.update.useMutation({
    onSuccess: async () => {
      setConflict(false);
      await Promise.all([
        utils.document.get.invalidate({ projectId, documentId }),
        utils.document.list.invalidate({ projectId }),
        utils.document.recent.invalidate({ projectId, limit: 6 }),
        utils.document.search.invalidate(),
        utils.document.linkedToTask.invalidate(),
      ]);
      setEditing(false);
      toast.success("Page saved");
    },
    onError: (error) => {
      if (error.data?.code === "CONFLICT") {
        setConflict(true);
        toast.error("This page changed elsewhere. Your draft is still here.");
      } else {
        toast.error(error.message);
      }
    },
  });

  const commit = () => {
    if (!document.data || !title.trim() || save.isPending) return;
    save.mutate({
      projectId,
      documentId,
      expectedVersion: document.data.version,
      title: title.trim(),
      body,
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!editing) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        commit();
      }
      if (event.key === "Escape") {
        if (!dirty || window.confirm("Discard your unsaved changes?")) {
          setTitle(document.data?.title ?? "");
          setBody(document.data?.body ?? "");
          setConflict(false);
          setEditing(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!editing || !dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, editing]);

  if (document.isError) {
    return (
      <div className="mx-auto max-w-4xl p-12">
        <p className="text-sm text-white/70">
          This page does not exist or you no longer have access.
        </p>
        <Button asChild className="mt-3" size="inline" variant="link">
          <Link href={`/app/p/${slug}/docs`}>Return to Docs</Link>
        </Button>
      </div>
    );
  }

  if (document.isLoading || !document.data) {
    return (
      <div className="mx-auto max-w-4xl p-12 text-sm text-white/40">
        Loading page…
      </div>
    );
  }

  const breadcrumbs = documentBreadcrumbs(documents, document.data.id);

  return (
    <motion.article
      className="mx-auto w-full max-w-4xl px-6 py-8 md:px-12 md:py-12"
      layout={reduceMotion ? false : "position"}
      transition={{
        layout: { duration: 0.22, ease: [0.77, 0, 0.175, 1] },
      }}
    >
      <div className="flex min-h-6 flex-wrap items-center gap-1 text-xs text-white/40">
        <Link
          className="transition hover:text-white/70"
          href={`/app/p/${slug}/docs`}
        >
          Docs
        </Link>
        {breadcrumbs.slice(0, -1).map((crumb) => (
          <span className="flex items-center gap-1" key={crumb.id}>
            <ChevronRight className="h-3 w-3 text-white/40" />
            <Link
              className="max-w-36 truncate transition hover:text-white/70"
              href={`/app/p/${slug}/docs/${crumb.id}`}
            >
              {crumb.title}
            </Link>
          </span>
        ))}
      </div>

      {editing ? (
        <div className="mt-6">
          <Input
            aria-label="Page title"
            autoFocus
            className="h-auto text-3xl font-semibold tracking-tight"
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
            variant="bare"
          />
          <div className="mt-5 border-t border-white/10 pt-1">
            <RichTextEditor
              className="prose-headings:mt-8 prose-headings:mb-3 prose-h1:text-2xl prose-h2:text-xl min-h-96 text-base leading-7"
              mentions={members}
              minHeight="50vh"
              onChange={setBody}
              placeholder="Write the context that should outlive the task…"
              tickets={tickets}
              toolbar="document"
              value={body}
            />
          </div>
          {conflict ? (
            <Card
              className="text-warning mt-5 flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs"
              padding="none"
              radius="md"
              tone="warning"
            >
              <span>
                A newer version exists. Copy your draft or reload before saving.
              </span>
              <span className="flex items-center gap-2">
                <Button
                  onClick={() =>
                    void navigator.clipboard.writeText(`${title}\n\n${body}`)
                  }
                  size="sm"
                  variant="outline"
                >
                  Copy draft
                </Button>
                <Button
                  onClick={() => {
                    void document.refetch().then((result) => {
                      if (!result.data) return;
                      setTitle(result.data.title);
                      setBody(result.data.body);
                      setConflict(false);
                    });
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Reload latest
                </Button>
              </span>
            </Card>
          ) : null}
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-white/10 pt-4">
            <Button
              onClick={() => {
                if (!dirty || window.confirm("Discard your unsaved changes?")) {
                  setTitle(document.data.title);
                  setBody(document.data.body);
                  setEditing(false);
                }
              }}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={!title.trim() || !dirty || save.isPending || conflict}
              onClick={commit}
              size="sm"
            >
              {save.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save <span className="text-black/70">⌘S</span>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <header className="mt-6 border-b border-white/10 pb-7">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {document.data.title}
                </h1>
                <p
                  className="mt-3 text-xs text-white/40"
                  title={formatDateTime(
                    document.data.updatedAt ?? document.data.createdAt,
                  )}
                >
                  Updated{" "}
                  {formatRelative(
                    document.data.updatedAt ?? document.data.createdAt,
                  )}{" "}
                  by {document.data.updatedByName} · v{document.data.version}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  onClick={() => setHistoryOpen(true)}
                  size="icon"
                  title="Page history"
                  variant="ghost"
                >
                  <History className="h-4 w-4" />
                </Button>
                {canWrite ? (
                  <>
                    <Button
                      onClick={onCreateChild}
                      size="icon"
                      title="New child page"
                      variant="ghost"
                    >
                      <FilePlus2 className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => setMoveOpen(true)}
                      size="icon"
                      title="Move page"
                      variant="ghost"
                    >
                      <FolderInput className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => setEditing(true)}
                      size="sm"
                      variant="outline"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </header>
          <div className="py-8">
            <RichTextContent
              className="prose-headings:mt-8 prose-headings:mb-3 prose-h1:text-2xl prose-h2:text-xl text-base leading-7"
              mentions={members}
              tickets={tickets}
              value={document.data.body}
            />
          </div>
        </>
      )}

      <HistorySheet
        canWrite={canWrite}
        currentVersion={document.data.version}
        documentId={documentId}
        onOpenChange={setHistoryOpen}
        open={historyOpen}
        projectId={projectId}
      />
      <MovePageDialog
        documentId={documentId}
        documents={documents}
        onOpenChange={setMoveOpen}
        open={moveOpen}
        projectId={projectId}
      />
    </motion.article>
  );
}

function HistorySheet({
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
      toast.success("Version restored as the latest revision");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Page history</SheetTitle>
          <SheetDescription>
            Every save is an immutable checkpoint.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
          <div className="space-y-1 border-r border-white/10 pr-3">
            {history.data?.map((item) => (
              <button
                className={cn(
                  segmentVariants({
                    active: selectedVersion === item.version,
                    size: "sm",
                  }),
                  "h-auto w-full flex-col items-start py-2 text-left whitespace-normal",
                )}
                key={item.id}
                onClick={() => setSelectedVersion(item.version)}
                type="button"
              >
                <span className="block font-medium">
                  Version {item.version}
                </span>
                <span className="text-2xs mt-0.5 block text-white/40">
                  {item.editorName} · {formatRelative(item.createdAt)}
                </span>
              </button>
            ))}
          </div>
          <div className="min-w-0">
            {selectedVersion && revision.data ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-sm font-medium">
                      {revision.data.title}
                    </h3>
                    <p className="mt-1 text-xs text-white/40">
                      Version {revision.data.version} by{" "}
                      {revision.data.editorName}
                    </p>
                  </div>
                  {canWrite && selectedVersion !== currentVersion ? (
                    <Button
                      disabled={restore.isPending}
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
                      Restore
                    </Button>
                  ) : null}
                </div>
                <RichTextContent value={revision.data.body} />
              </>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center text-center text-xs text-white/40">
                <Clock3 className="mb-3 h-5 w-5" />
                Select a version to preview it
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MovePageDialog({
  open,
  onOpenChange,
  projectId,
  documentId,
  documents,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  documentId: string;
  documents: DocumentList;
}) {
  const utils = api.useUtils();
  const current = documents.find((document) => document.id === documentId);
  const [parentId, setParentId] = useState<string>(current?.parentId ?? "");
  useEffect(
    () => setParentId(current?.parentId ?? ""),
    [current?.parentId, open],
  );
  const blocked = descendantIds(documents, documentId);
  const move = api.document.move.useMutation({
    onSuccess: async () => {
      await utils.document.list.invalidate({ projectId });
      onOpenChange(false);
      toast.success("Page moved");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move page</DialogTitle>
          <DialogDescription>
            Choose a new parent. The page moves to the end of that section.
          </DialogDescription>
        </DialogHeader>
        <Select
          className="w-full"
          onChange={(event) => setParentId(event.target.value)}
          value={parentId}
        >
          <option value="">Top level</option>
          {documents
            .filter(
              (document) =>
                document.id !== documentId && !blocked.has(document.id),
            )
            .map((document) => (
              <option key={document.id} value={document.id}>
                {document.title}
              </option>
            ))}
        </Select>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={move.isPending || (current?.parentId ?? "") === parentId}
            onClick={() =>
              move.mutate({
                projectId,
                documentId,
                parentId: parentId || null,
                beforeId: null,
                afterId: null,
              })
            }
          >
            Move page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function flattenDocuments(documents: DocumentList) {
  const children = new Map<string | null, DocumentList>();
  for (const document of documents) {
    const key = document.parentId;
    children.set(key, [...(children.get(key) ?? []), document]);
  }
  for (const rows of children.values())
    rows.sort((a, b) => a.position - b.position);
  const result: Array<{ document: DocumentList[number]; depth: number }> = [];
  const visited = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const document of children.get(parentId) ?? []) {
      if (visited.has(document.id)) continue;
      visited.add(document.id);
      result.push({ document, depth });
      walk(document.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const document of documents) {
    if (!visited.has(document.id)) result.push({ document, depth: 0 });
  }
  return result;
}

function documentBreadcrumbs(documents: DocumentList, documentId: string) {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const result: DocumentList = [];
  const visited = new Set<string>();
  let cursor = byId.get(documentId);
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    result.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return result;
}

function descendantIds(documents: DocumentList, documentId: string) {
  const ids = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const document of documents) {
      if (
        document.parentId === documentId ||
        (document.parentId && ids.has(document.parentId))
      ) {
        if (!ids.has(document.id)) {
          ids.add(document.id);
          changed = true;
        }
      }
    }
  }
  return ids;
}
