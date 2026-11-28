"use client";

import { formatDateTime, formatRelative } from "@kanbi/shared";
import { TRPCClientError } from "@trpc/client";
import {
  CopyIcon,
  EllipsisIcon,
  FilePlus2Icon,
  FileQuestionIcon,
  FolderInputIcon,
  HistoryIcon,
  LinkIcon,
  StarIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  Fragment,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { RichTextContent, RichTextEditor } from "@/components/rich-text/editor";
import type { PageMentionItem } from "@/components/rich-text/page-mention";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useUnsavedWork } from "@/lib/session-expiry";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";
import { PageIcon } from "./docs-tree";
import { HistoryDrawer } from "./history-drawer";
import {
  Backlinks,
  IconPicker,
  PageOutline,
  PresenceAvatars,
  useDocImageUpload,
  usePresence,
} from "./page-extras";
import { documentBreadcrumbs, type DocumentList } from "./tree";
import type { DocActions } from "./use-doc-actions";

const PROSE =
  "prose-headings:mt-8 prose-headings:mb-3 prose-h1:text-2xl prose-h2:text-xl text-base leading-7";
const UNTITLED = "Untitled";
const AUTOSAVE_MS = 800;
const RETRY_MS = 5_000;

type AuthoringContext = RouterOutputs["document"]["authoringContext"];
type DocumentData = RouterOutputs["document"]["get"];
type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

const toSavedTitle = (title: string) => title.trim() || UNTITLED;
const toInputTitle = (title: string) => (title === UNTITLED ? "" : title);

export function DocumentView({
  projectId,
  slug,
  documentId,
  documents,
  canWrite,
  members,
  tickets,
  onCreateChild,
  onMove,
  actions: docActions,
  pages,
}: {
  projectId: string;
  slug: string;
  documentId: string;
  documents: DocumentList;
  canWrite: boolean;
  members: AuthoringContext["members"];
  tickets: AuthoringContext["tickets"] & Array<{ href?: string }>;
  onCreateChild: () => void;
  onMove: () => void;
  actions: DocActions;
  pages: PageMentionItem[];
}) {
  const reduceMotion = useReducedMotion();
  const document = api.document.get.useQuery({ projectId, documentId });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const viewers = usePresence(projectId, documentId, editing);
  const contentRef = useRef<HTMLDivElement>(null);
  // outline follows unsaved edits, not just the last save
  const [liveBody, setLiveBody] = useState<string | null>(null);
  useEffect(() => setLiveBody(null), [documentId]);

  if (document.isError) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            This page doesn&apos;t exist or you no longer have access.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            render={<Link href={`/app/p/${slug}/docs`} />}
            size="sm"
            variant="outline"
          >
            Back to docs
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (document.isLoading || !document.data) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-10 md:px-10 md:py-14">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-3 w-48" />
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    );
  }

  const data = document.data;
  const breadcrumbs = documentBreadcrumbs(documents, data.id).slice(0, -1);
  const listed = documents.find((doc) => doc.id === data.id);
  // list is optimistic for icon/favorite; get may lag
  const icon = listed ? listed.icon : data.icon;
  const favorite = Boolean(listed?.favoritedAt);

  const actions = (
    <div className="flex shrink-0 items-center gap-1">
      <PresenceAvatars viewers={viewers} />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={favorite}
              onClick={() => docActions.toggleFavorite(documentId)}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <StarIcon
            aria-hidden="true"
            className={cn(favorite && "fill-amber-400 text-amber-400")}
          />
        </TooltipTrigger>
        <TooltipPopup>{favorite ? "Unfavorite" : "Favorite"}</TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Page history"
              onClick={() => setHistoryOpen(true)}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <HistoryIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipPopup>Page history</TooltipPopup>
      </Tooltip>
      <Menu>
        <MenuTrigger
          aria-label="More page actions"
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <EllipsisIcon aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuItem
            onClick={() => {
              const url = `${window.location.origin}/app/p/${slug}/docs/${documentId}`;
              void navigator.clipboard
                .writeText(url)
                .then(() =>
                  toastManager.add({ type: "success", title: "Link copied" }),
                );
            }}
          >
            <LinkIcon aria-hidden="true" />
            Copy link
          </MenuItem>
          {canWrite ? (
            <>
              <MenuItem onClick={onCreateChild}>
                <FilePlus2Icon aria-hidden="true" />
                New child page
              </MenuItem>
              <MenuItem onClick={() => docActions.duplicate(documentId)}>
                <CopyIcon aria-hidden="true" />
                Duplicate
              </MenuItem>
              <MenuItem onClick={onMove}>
                <FolderInputIcon aria-hidden="true" />
                Move page…
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                onClick={() => docActions.remove(documentId)}
                variant="destructive"
              >
                <Trash2Icon aria-hidden="true" />
                Delete
              </MenuItem>
            </>
          ) : null}
        </MenuPopup>
      </Menu>
    </div>
  );

  return (
    <motion.article
      className="group/page relative mx-auto flex w-full max-w-3xl flex-col px-6 pt-8 pb-24 md:px-10 md:pt-12"
      onBlurCapture={() => setEditing(false)}
      onFocusCapture={(event) => {
        const el = event.target as HTMLElement;
        setEditing(el.isContentEditable || el.tagName === "TEXTAREA");
      }}
      layout={reduceMotion ? false : "position"}
      transition={{ layout: { duration: 0.22, ease: [0.77, 0, 0.175, 1] } }}
    >
      <div className="flex items-center justify-between gap-4">
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={`/app/p/${slug}/docs`} />}>
                Docs
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs.map((crumb) => (
              <Fragment key={crumb.id}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="max-w-36 truncate"
                    render={<Link href={`/app/p/${slug}/docs/${crumb.id}`} />}
                  >
                    <PageIcon className="me-1" icon={crumb.icon} />
                    {crumb.title}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        {actions}
      </div>

      <IconPicker
        canWrite={canWrite}
        icon={icon}
        onChange={(next) => docActions.setIcon(documentId, next)}
      />
      {canWrite ? (
        <PageEditor
          contentRef={contentRef}
          key={documentId}
          members={members}
          onBodyChange={setLiveBody}
          pages={pages}
          projectId={projectId}
          refetch={async () => (await document.refetch()).data}
          server={data}
          tickets={tickets}
        />
      ) : (
        <>
          <h1
            className={cn(
              "font-heading text-3xl font-semibold tracking-tight md:text-4xl",
              icon ? "mt-3" : "mt-6",
            )}
          >
            {data.title}
          </h1>
          <UpdatedLine data={data} />
          <div className="mt-8" ref={contentRef}>
            <RichTextContent
              className={PROSE}
              mentions={members}
              pages={pages}
              tickets={tickets}
              value={data.body}
            />
          </div>
        </>
      )}

      <Backlinks documentId={documentId} projectId={projectId} slug={slug} />
      <PageOutline contentRef={contentRef} html={liveBody ?? data.body} />

      <HistoryDrawer
        canWrite={canWrite}
        currentVersion={data.version}
        documentId={documentId}
        onOpenChange={setHistoryOpen}
        open={historyOpen}
        projectId={projectId}
      />
    </motion.article>
  );
}

function UpdatedLine({
  data,
  status,
}: {
  data: DocumentData;
  status?: ReactNode;
}) {
  const updatedAt = data.updatedAt ?? data.createdAt;
  return (
    <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
      <span title={formatDateTime(updatedAt)}>
        Updated {formatRelative(updatedAt)} by {data.updatedByName}
      </span>
      {status}
    </p>
  );
}

function isConflict(error: unknown) {
  return (
    error instanceof TRPCClientError &&
    (error.data as { code?: string } | undefined)?.code === "CONFLICT"
  );
}

function PageEditor({
  projectId,
  server,
  refetch,
  members,
  tickets,
  pages,
  contentRef,
  onBodyChange,
}: {
  projectId: string;
  server: DocumentData;
  refetch: () => Promise<DocumentData | undefined>;
  members: AuthoringContext["members"];
  tickets: AuthoringContext["tickets"] & Array<{ href?: string }>;
  pages: PageMentionItem[];
  contentRef: RefObject<HTMLDivElement | null>;
  onBodyChange: (body: string) => void;
}) {
  const documentId = server.id;
  const utils = api.useUtils();
  const editorWrap = contentRef;
  const uploadImage = useDocImageUpload(projectId, documentId);
  const uploading = useRef(0);
  const [title, setTitle] = useState(() => toInputTitle(server.title));
  const [body, setBody] = useState(server.body);
  const [status, setStatus] = useState<SaveStatus>("idle");
  // last persisted state; ref so flush (incl. on unmount) never reads stale closures
  const saved = useRef({
    title: server.title,
    body: server.body,
    version: server.version,
  });
  const latest = useRef({ title, body });
  latest.current = { title, body };
  const inflight = useRef(false);
  const queued = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const dirty =
    toSavedTitle(title) !== saved.current.title || body !== saved.current.body;
  useUnsavedWork(dirty || status === "saving");

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (inflight.current) {
      queued.current = true;
      return;
    }
    const next = {
      title: toSavedTitle(latest.current.title),
      body: latest.current.body,
    };
    const base = saved.current;
    if (next.title === base.title && next.body === base.body) return;
    // body still has blob: srcs; onUploadingChange(0) flushes after
    if (uploading.current > 0 || next.body.includes('src="blob:')) return;
    inflight.current = true;
    setStatus("saving");
    try {
      const result = await utils.client.document.update.mutate({
        projectId,
        documentId,
        expectedVersion: base.version,
        coalesce: true,
        ...next,
      });
      saved.current = { ...next, version: result.version };
      setStatus("saved");
      void Promise.all([
        utils.document.get.invalidate({ projectId, documentId }),
        utils.document.list.invalidate({ projectId }),
        utils.document.recent.invalidate({ projectId }),
        utils.document.search.invalidate(),
        utils.document.linkedToTask.invalidate(),
      ]);
    } catch (error) {
      queued.current = false;
      if (isConflict(error)) {
        setStatus("conflict");
        void refetchRef.current();
      } else {
        setStatus("error");
        timer.current = setTimeout(() => void flush(), RETRY_MS);
      }
    } finally {
      inflight.current = false;
      if (queued.current) {
        queued.current = false;
        void flush();
      }
    }
  }, [documentId, projectId, utils]);

  useEffect(() => {
    if (!dirty || status === "conflict") return;
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(timer.current);
  }, [body, dirty, flush, status, title]);

  // leaving the page (route change) -> save what's pending
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current(), []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!inflight.current && !dirty) return;
      void flush();
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, flush]);

  // live sidebar/breadcrumb title while typing
  useEffect(() => {
    const next = toSavedTitle(title);
    utils.document.list.setData({ projectId }, (old) =>
      old?.map((doc) =>
        doc.id === documentId && doc.title !== next
          ? { ...doc, title: next }
          : doc,
      ),
    );
  }, [documentId, projectId, title, utils]);

  const adopt = useCallback((doc: DocumentData) => {
    saved.current = { title: doc.title, body: doc.body, version: doc.version };
    setTitle(toInputTitle(doc.title));
    setBody(doc.body);
    setStatus("idle");
  }, []);

  // someone else (or a restore) saved a newer version; take it if we have nothing pending
  useEffect(() => {
    if (server.version <= saved.current.version) return;
    if (status === "conflict" || inflight.current || dirty) return;
    adopt(server);
  }, [adopt, dirty, server, status]);

  const focusBody = () =>
    editorWrap.current?.querySelector<HTMLElement>(".ProseMirror")?.focus();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void flush();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flush]);

  const fresh = server.title === UNTITLED && server.body === "<p></p>";

  return (
    <div className="mt-2 flex flex-col">
      <textarea
        aria-label="Page title"
        autoFocus={fresh}
        className="font-heading placeholder:text-muted-foreground/60 field-sizing-content w-full resize-none bg-transparent text-3xl font-semibold tracking-tight outline-none md:text-4xl"
        maxLength={160}
        onChange={(event) => setTitle(event.target.value.replace(/\n/g, ""))}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "ArrowDown") {
            if (
              event.key === "ArrowDown" &&
              event.currentTarget.selectionEnd !== title.length
            )
              return;
            event.preventDefault();
            focusBody();
          }
        }}
        placeholder={UNTITLED}
        rows={1}
        value={title}
      />
      <UpdatedLine data={server} status={<SaveIndicator status={status} />} />
      {status === "conflict" ? (
        <Alert className="mt-5" variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Someone else edited this page</AlertTitle>
          <AlertDescription>
            Your changes aren&apos;t saved yet. Keep yours or load theirs.
          </AlertDescription>
          <AlertAction>
            <Button
              onClick={() => {
                void refetch().then((doc) => {
                  if (!doc) return;
                  saved.current = { ...saved.current, version: doc.version };
                  setStatus("idle");
                  void flush();
                });
              }}
              size="xs"
              variant="outline"
            >
              Keep mine
            </Button>
            <Button
              onClick={() => {
                void refetch().then((doc) => doc && adopt(doc));
              }}
              size="xs"
              variant="ghost"
            >
              Load theirs
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      <div
        className="mt-6"
        onKeyDown={(event) => {
          // defaultPrevented = an editor popup (mentions, slash) consumed it
          if (event.key === "Escape" && !event.defaultPrevented)
            (window.document.activeElement as HTMLElement | null)?.blur();
        }}
        ref={editorWrap}
      >
        <RichTextEditor
          className={`${PROSE} min-h-96`}
          mentions={members}
          minHeight="50vh"
          onBlur={() => void flush()}
          onChange={(html) => {
            setBody(html);
            onBodyChange(html);
          }}
          onUploadingChange={(count) => {
            uploading.current = count;
            if (count === 0) void flush();
          }}
          pages={pages}
          placeholder="Write something, or press / for commands…"
          tickets={tickets}
          uploadImage={uploadImage}
          variant="document"
          value={body}
        />
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Couldn't save, retrying…"
          : null;
  if (!label) return null;
  return (
    <span
      aria-live="polite"
      className={status === "error" ? "text-destructive-foreground" : undefined}
    >
      · {label}
    </span>
  );
}
