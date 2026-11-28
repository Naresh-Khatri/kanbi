"use client";

import { formatRelative } from "@kanbi/shared";
import { SmilePlusIcon } from "lucide-react";
import Link from "next/link";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { fileUrl } from "@/lib/file-url";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { PageIcon } from "./docs-tree";

const EMOJI = [
  "📄", "📝", "📌", "📎", "📚", "📖", "🗂️", "🗃️",
  "💡", "🎯", "🚀", "⭐", "🔥", "✅", "❗", "❓",
  "🛠️", "⚙️", "🧪", "🐛", "🔒", "🔑", "📦", "🧩",
  "📈", "📊", "💰", "🧾", "🗓️", "⏱️", "📣", "💬",
  "🎨", "🖼️", "📱", "💻", "🌐", "🤝", "👋", "🏁",
];

export function IconPicker({
  icon,
  onChange,
  canWrite,
}: {
  icon: string | null;
  onChange: (icon: string | null) => void;
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!canWrite) {
    return icon ? (
      <span aria-hidden="true" className="mt-6 block text-5xl leading-none">
        {icon}
      </span>
    ) : null;
  }
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={icon ? "Change icon" : "Add icon"}
        render={
          icon ? (
            <button
              className="hover:bg-accent mt-6 -ms-1 w-fit rounded-md p-1 text-5xl leading-none transition-colors"
              type="button"
            />
          ) : (
            <Button
              className="text-muted-foreground mt-6 -ms-2 w-fit opacity-0 group-hover/page:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
              size="xs"
              variant="ghost"
            />
          )
        }
      >
        {icon ?? (
          <>
            <SmilePlusIcon aria-hidden="true" />
            Add icon
          </>
        )}
      </PopoverTrigger>
      <PopoverPopup align="start" className="w-auto">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI.map((emoji) => (
            <button
              aria-label={emoji}
              className={cn(
                "hover:bg-accent flex size-8 items-center justify-center rounded-md text-lg",
                emoji === icon && "bg-accent",
              )}
              key={emoji}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
              type="button"
            >
              {emoji}
            </button>
          ))}
        </div>
        {icon ? (
          <Button
            className="mt-2 w-full"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            size="xs"
            variant="ghost"
          >
            Remove icon
          </Button>
        ) : null}
      </PopoverPopup>
    </Popover>
  );
}

type Heading = { level: number; text: string };

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

// regex, not DOMParser: same result on server and client (no hydration mismatch)
function headingsOf(html: string): Heading[] {
  return [...html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/g)]
    .map((m) => ({
      level: Number(m[1]),
      text: m[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/&[a-z#0-9]+;/g, (e) => ENTITIES[e] ?? e)
        .trim(),
    }))
    .filter((h) => h.text);
}

/** "On this page": wide screens only, needs 2+ headings. */
export function PageOutline({
  html,
  contentRef,
}: {
  html: string;
  contentRef: RefObject<HTMLElement | null>;
}) {
  const headings = useMemo(() => headingsOf(html), [html]);
  if (headings.length < 2) return null;
  const top = Math.min(...headings.map((h) => h.level));
  return (
    <aside className="absolute inset-y-0 start-full ms-8 hidden w-52 2xl:block">
      <nav aria-label="On this page" className="sticky top-12">
        <p className="text-muted-foreground mb-2 text-xs font-medium">
          On this page
        </p>
        <ul className="flex flex-col gap-0.5 border-s">
          {headings.map((heading, index) => (
            <li key={`${index}-${heading.text}`}>
              <button
                className="text-muted-foreground hover:text-foreground -ms-px block w-full truncate border-s border-transparent py-0.5 text-start text-xs transition-colors hover:border-foreground/40"
                onClick={() => {
                  const nodes =
                    contentRef.current?.querySelectorAll("h1, h2, h3");
                  nodes?.[index]?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                style={{
                  paddingInlineStart: `${10 + (heading.level - top) * 12}px`,
                }}
                type="button"
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export function Backlinks({
  projectId,
  documentId,
  slug,
}: {
  projectId: string;
  documentId: string;
  slug: string;
}) {
  const backlinks = api.document.backlinks.useQuery({ projectId, documentId });
  const rows = backlinks.data ?? [];
  if (rows.length === 0) return null;
  return (
    <section aria-label="Linked from" className="mt-16 border-t pt-6">
      <h2 className="text-muted-foreground mb-2 text-xs font-medium">
        Linked from {rows.length} page{rows.length === 1 ? "" : "s"}
      </h2>
      <ul className="flex flex-col gap-px">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              className="hover:bg-accent -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              href={`/app/p/${slug}/docs/${row.id}`}
            >
              <PageIcon icon={row.icon} />
              <span className="min-w-0 flex-1 truncate">{row.title}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {formatRelative(row.updatedAt ?? row.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const HEARTBEAT_MS = 15_000;

type Viewer = { id: string; name: string; image: string | null; editing: boolean };

export function usePresence(
  projectId: string,
  documentId: string,
  editing: boolean,
) {
  const utils = api.useUtils();
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const editingRef = useRef(editing);
  editingRef.current = editing;

  const beat = useCallback(
    (leaving = false) =>
      utils.client.document.presence
        .mutate({ projectId, documentId, editing: editingRef.current, leaving })
        .then((rows) => !leaving && setViewers(rows))
        .catch(() => undefined),
    [documentId, projectId, utils],
  );

  useEffect(() => {
    setViewers([]);
    void beat();
    const id = setInterval(() => {
      if (window.document.visibilityState === "visible") void beat();
    }, HEARTBEAT_MS);
    return () => {
      clearInterval(id);
      void beat(true);
    };
  }, [beat]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void beat();
  }, [beat, editing]);

  return viewers;
}

export function PresenceAvatars({ viewers }: { viewers: Viewer[] }) {
  if (viewers.length === 0) return null;
  const shown = viewers.slice(0, 4);
  return (
    <div className="me-1 flex items-center -space-x-1.5">
      {shown.map((viewer) => (
        <Tooltip key={viewer.id}>
          <TooltipTrigger
            render={
              <span
                className={cn(
                  "ring-background rounded-full ring-2",
                  viewer.editing && "ring-primary",
                )}
              />
            }
          >
            <UserAvatar image={viewer.image} name={viewer.name} size={22} />
          </TooltipTrigger>
          <TooltipPopup>
            {viewer.name} · {viewer.editing ? "editing" : "viewing"}
          </TooltipPopup>
        </Tooltip>
      ))}
      {viewers.length > shown.length ? (
        <span className="bg-muted text-muted-foreground ring-background flex size-[22px] items-center justify-center rounded-full text-[10px] ring-2">
          +{viewers.length - shown.length}
        </span>
      ) : null}
    </div>
  );
}

/** presign -> PUT -> register; returns the stable /api/files url. */
export function useDocImageUpload(projectId: string, documentId: string) {
  const { mutateAsync: createUploadUrl } =
    api.document.createUploadUrl.useMutation();
  const { mutateAsync: register } = api.document.registerFile.useMutation();
  return useCallback(
    async (file: File) => {
      const mime = file.type || "application/octet-stream";
      const { key, uploadUrl } = await createUploadUrl({
        projectId,
        filename: file.name,
        mime,
        sizeBytes: file.size,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed: ${file.name}`);
      const { id } = await register({
        projectId,
        documentId,
        key,
        filename: file.name,
      });
      return fileUrl(id);
    },
    [createUploadUrl, documentId, projectId, register],
  );
}
