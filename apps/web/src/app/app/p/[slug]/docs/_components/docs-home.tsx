"use client";

import { formatRelative } from "@kanbi/shared";
import {
  BookOpenIcon,
  ChevronRightIcon,
  FilePlus2Icon,
  FileTextIcon,
} from "lucide-react";
import Link from "next/link";

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
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import type { RouterOutputs } from "@/trpc/react";

export function DocsHome({
  recent,
  loading,
  slug,
  canWrite,
  hasDocuments,
  creating,
  onCreate,
}: {
  recent: RouterOutputs["document"]["recent"];
  loading: boolean;
  slug: string;
  canWrite: boolean;
  hasDocuments: boolean;
  creating: boolean;
  onCreate: () => void;
}) {
  const newPage = canWrite ? (
    <Button loading={creating} onClick={onCreate} size="sm">
      <FilePlus2Icon aria-hidden="true" />
      New page
    </Button>
  ) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Docs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Decisions, briefs, and runbooks beside the work they explain.
          </p>
        </div>
        {recent.length > 0 ? newPage : null}
      </header>

      {loading ? (
        <Frame>
          <FramePanel className="flex flex-col gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div className="flex items-center gap-3" key={i}>
                <Skeleton className="size-8 rounded-md" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </FramePanel>
        </Frame>
      ) : recent.length > 0 ? (
        <Frame>
          <FrameHeader>
            <FrameTitle>Recently updated</FrameTitle>
          </FrameHeader>
          <FramePanel className="overflow-hidden p-0">
            <ul className="divide-y">
              {recent.map((document) => (
                <li key={document.id}>
                  <Link
                    className="hover:bg-accent/50 focus-visible:bg-accent/50 flex items-center gap-3 px-4 py-3 transition-colors outline-none"
                    href={`/app/p/${slug}/docs/${document.id}`}
                  >
                    <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
                      <FileTextIcon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {document.title}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {document.updatedByName} ·{" "}
                        {formatRelative(
                          document.updatedAt ?? document.createdAt,
                        )}
                      </span>
                    </span>
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="text-muted-foreground size-4"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </FramePanel>
        </Frame>
      ) : (
        <Empty className="rounded-2xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {hasDocuments
                ? "Nothing updated recently"
                : "Start the project record"}
            </EmptyTitle>
            <EmptyDescription>
              Create one page for the context that should outlive a task or
              meeting.
            </EmptyDescription>
          </EmptyHeader>
          {newPage ? <EmptyContent>{newPage}</EmptyContent> : null}
        </Empty>
      )}
    </div>
  );
}
