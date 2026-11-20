"use client";

import { formatDateTime, formatRelative } from "@kanbi/shared";
import {
  EllipsisIcon,
  FilePlus2Icon,
  FileQuestionIcon,
  FolderInputIcon,
  HistoryIcon,
  PencilIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";

import { RichTextContent, RichTextEditor } from "@/components/rich-text/editor";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useUnsavedWork } from "@/lib/session-expiry";
import { api, type RouterOutputs } from "@/trpc/react";
import { HistoryDrawer } from "./history-drawer";
import { documentBreadcrumbs, type DocumentList } from "./tree";

const PROSE =
  "prose-headings:mt-8 prose-headings:mb-3 prose-h1:text-2xl prose-h2:text-xl text-base leading-7";

type AuthoringContext = RouterOutputs["document"]["authoringContext"];

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
  const [discardOpen, setDiscardOpen] = useState(false);
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
  useUnsavedWork(dirty);

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
      toastManager.add({ type: "success", title: "Page saved" });
    },
    onError: (error) => {
      if (error.data?.code === "CONFLICT") {
        setConflict(true);
        toastManager.add({
          type: "error",
          title: "This page changed elsewhere",
          description: "Your draft is still here.",
        });
      } else {
        toastManager.add({ type: "error", title: error.message });
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

  const discard = () => {
    setTitle(document.data?.title ?? "");
    setBody(document.data?.body ?? "");
    setConflict(false);
    setEditing(false);
    setDiscardOpen(false);
  };
  const requestDiscard = () => (dirty ? setDiscardOpen(true) : discard());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!editing || discardOpen) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        commit();
      }
      // defaultPrevented = an editor popup (mentions) consumed it
      if (event.key === "Escape" && !event.defaultPrevented) requestDiscard();
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
  const updatedAt = data.updatedAt ?? data.createdAt;

  return (
    <motion.article
      className="mx-auto flex w-full max-w-3xl flex-col px-6 pt-8 md:px-10 md:pt-12"
      layout={reduceMotion ? false : "position"}
      transition={{ layout: { duration: 0.22, ease: [0.77, 0, 0.175, 1] } }}
    >
      <Breadcrumb>
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
                  {crumb.title}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {editing ? (
        <div className="mt-6 flex flex-col">
          <input
            aria-label="Page title"
            autoFocus
            className="font-heading placeholder:text-muted-foreground/72 w-full bg-transparent text-3xl font-semibold tracking-tight outline-none"
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled"
            value={title}
          />
          {conflict ? (
            <Alert className="mt-5" variant="warning">
              <TriangleAlertIcon />
              <AlertTitle>A newer version exists</AlertTitle>
              <AlertDescription>
                Copy your draft or reload the latest before saving.
              </AlertDescription>
              <AlertAction>
                <Button
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(`${title}\n\n${body}`)
                      .then(() =>
                        toastManager.add({
                          type: "success",
                          title: "Draft copied",
                        }),
                      );
                  }}
                  size="xs"
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
                  size="xs"
                  variant="ghost"
                >
                  Reload latest
                </Button>
              </AlertAction>
            </Alert>
          ) : null}
          <div className="mt-5 border-t pt-1">
            <RichTextEditor
              className={`${PROSE} min-h-96`}
              mentions={members}
              minHeight="50vh"
              onChange={setBody}
              placeholder="Write the context that should outlive the task…"
              tickets={tickets}
              variant="document"
              value={body}
            />
          </div>
          <div className="bg-background sticky bottom-0 mt-6 flex items-center justify-between gap-3 border-t py-3">
            <div className="flex min-w-0 items-center gap-2">
              <SaveState
                conflict={conflict}
                dirty={dirty}
                saving={save.isPending}
              />
              <span className="text-muted-foreground hidden items-center gap-1 text-xs sm:flex">
                <Kbd>⌘S</Kbd> save · <Kbd>Esc</Kbd> cancel
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={requestDiscard} size="sm" variant="ghost">
                Cancel
              </Button>
              <Button
                disabled={!title.trim() || !dirty || conflict}
                loading={save.isPending}
                onClick={commit}
                size="sm"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <header className="mt-5 flex items-start justify-between gap-6 border-b pb-6">
            <div className="min-w-0">
              <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
                {data.title}
              </h1>
              <p
                className="text-muted-foreground mt-2 text-xs"
                title={formatDateTime(updatedAt)}
              >
                Updated {formatRelative(updatedAt)} by {data.updatedByName} · v
                {data.version}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
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
              {canWrite ? (
                <>
                  <Menu>
                    <MenuTrigger
                      aria-label="More page actions"
                      render={<Button size="icon-sm" variant="ghost" />}
                    >
                      <EllipsisIcon aria-hidden="true" />
                    </MenuTrigger>
                    <MenuPopup align="end">
                      <MenuItem onClick={onCreateChild}>
                        <FilePlus2Icon aria-hidden="true" />
                        New child page
                      </MenuItem>
                      <MenuItem onClick={onMove}>
                        <FolderInputIcon aria-hidden="true" />
                        Move page…
                      </MenuItem>
                    </MenuPopup>
                  </Menu>
                  <Button
                    onClick={() => setEditing(true)}
                    size="sm"
                    variant="outline"
                  >
                    <PencilIcon aria-hidden="true" />
                    Edit
                  </Button>
                </>
              ) : null}
            </div>
          </header>
          <div className="py-8">
            <RichTextContent
              className={PROSE}
              mentions={members}
              tickets={tickets}
              value={data.body}
            />
          </div>
        </>
      )}

      <HistoryDrawer
        canWrite={canWrite}
        currentVersion={data.version}
        documentId={documentId}
        onOpenChange={setHistoryOpen}
        open={historyOpen}
        projectId={projectId}
      />
      <AlertDialog onOpenChange={setDiscardOpen} open={discardOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits to this page will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>
              Keep editing
            </AlertDialogClose>
            <Button onClick={discard} variant="destructive">
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </motion.article>
  );
}

function SaveState({
  saving,
  dirty,
  conflict,
}: {
  saving: boolean;
  dirty: boolean;
  conflict: boolean;
}) {
  if (saving)
    return (
      <Badge variant="secondary">
        <Spinner className="size-3" />
        Saving…
      </Badge>
    );
  if (conflict) return <Badge variant="warning">Conflict</Badge>;
  if (dirty) return <Badge variant="outline">Unsaved changes</Badge>;
  return <Badge variant="outline">No changes</Badge>;
}
