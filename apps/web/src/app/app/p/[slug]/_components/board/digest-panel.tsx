"use client";

import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  formatDate,
  formatDateRange,
  formatRelative,
  formatWeekday,
} from "@kanbi/shared";
import { useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import type { DigestCategory, DigestHighlight } from "@/server/db/schema";
import { api } from "@/trpc/react";

type Member = { userId: string; name: string | null; image: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;

const STAT_DEFS = [
  { key: "created", label: "created", Icon: Plus, accent: false },
  { key: "moved", label: "moved", Icon: ArrowRight, accent: false },
  { key: "completed", label: "completed", Icon: CheckCircle2, accent: true },
  { key: "comments", label: "comments", Icon: MessageSquare, accent: false },
] as const;

const GROUPS: { category: DigestCategory; label: string }[] = [
  { category: "shipped", label: "Shipped" },
  { category: "progress", label: "In progress" },
  { category: "created", label: "Created" },
  { category: "discussion", label: "Discussion" },
  { category: "other", label: "Also notable" },
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Tiny per-day activity bar chart for the window. */
function Sparkline({ data, start }: { data: number[]; start: Date | string }) {
  const max = Math.max(1, ...data);
  const startMs = new Date(start).getTime();
  return (
    <div className="flex h-7 items-end gap-1">
      {data.map((v, i) => {
        const day = new Date(startMs + i * DAY_MS);
        const label = `${formatWeekday(day)}, ${formatDate(day, {
          relativeDays: false,
        })}`;
        return (
          <div
            className="flex-1 rounded-sm bg-white/15 transition-colors hover:bg-white/25"
            key={i}
            style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
            title={`${label}: ${v} update${v === 1 ? "" : "s"}`}
          />
        );
      })}
    </div>
  );
}

/** Emphasize numbers and known people inline within the AI prose. */
function FormattedSummary({ text, names }: { text: string; names: string[] }) {
  const nodes = useMemo(() => {
    const sorted = names
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    const namePart = sorted.length ? `|${sorted.join("|")}` : "";
    const re = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?${namePart})`, "gi");
    const nameSet = new Set(names.map((n) => n.toLowerCase()));
    return text.split(re).map((part, i) => {
      if (!part) return null;
      if (/^\d/.test(part))
        return (
          <strong className="font-semibold text-white" key={i}>
            {part}
          </strong>
        );
      if (nameSet.has(part.toLowerCase()))
        return (
          <span className="font-medium text-white/90" key={i}>
            {part}
          </span>
        );
      return <span key={i}>{part}</span>;
    });
  }, [text, names]);

  return <p className="text-sm leading-relaxed text-white/70">{nodes}</p>;
}

function HighlightRow({
  highlight: h,
  image,
  onOpen,
}: {
  highlight: DigestHighlight;
  image: string | null;
  onOpen?: () => void;
}) {
  const inner = (
    <>
      {h.actor ? (
        <UserAvatar className="mt-0.5" image={image} name={h.actor} size={22} />
      ) : (
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
      )}
      <p className="text-sm leading-relaxed text-white/55">
        {h.actor ? (
          <span className="font-medium text-white/90">{h.actor} </span>
        ) : null}
        {h.action}
        {h.task ? (
          <span className="font-medium text-white/90"> “{h.task}”</span>
        ) : null}
      </p>
    </>
  );

  if (onOpen) {
    return (
      <li>
        <button
          className="-mx-2 flex w-full items-start gap-2.5 rounded-md px-2 py-1 text-left transition hover:bg-white/5"
          onClick={onOpen}
          type="button"
        >
          {inner}
        </button>
      </li>
    );
  }
  return <li className="flex items-start gap-2.5 py-1">{inner}</li>;
}

export function DigestPanel({
  boardId,
  open,
  onOpenChange,
  canWrite,
  members,
  onOpenTask,
}: {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  members: Member[];
  onOpenTask?: (taskId: string) => void;
}) {
  const utils = api.useUtils();
  const latest = api.digest.latest.useQuery({ boardId }, { enabled: open });
  const generate = api.digest.generate.useMutation({
    onSuccess: () => utils.digest.latest.invalidate({ boardId }),
    onError: (e) => toast.error(e.message),
  });

  const { nameToImage, memberNames } = useMemo(() => {
    const nameToImage = new Map<string, string | null>();
    const memberNames: string[] = [];
    for (const m of members) {
      if (m.name) {
        nameToImage.set(m.name.toLowerCase(), m.image);
        memberNames.push(m.name);
      }
    }
    return { nameToImage, memberNames };
  }, [members]);
  const imageById = useMemo(
    () => new Map(members.map((m) => [m.userId, m.image])),
    [members],
  );

  const digest = latest.data;
  const highlights = digest ? digest.content.highlights : [];
  const people = digest ? digest.content.people : [];
  const activity = digest ? digest.content.activity : [];

  const groups = GROUPS.map((g) => ({
    ...g,
    items: highlights.filter((h) => h.category === g.category),
  })).filter((g) => g.items.length > 0);
  const showLabels = groups.length > 1;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tracking-wide text-white/45 uppercase">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Weekly digest
            </span>
            {digest ? (
              <span className="flex items-center gap-2 tracking-normal normal-case text-white/45">
                <span className="text-white/20">·</span>
                {formatDateRange(digest.periodStart, digest.periodEnd)}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="sr-only">
            An AI summary of the last 7 days of board activity.
          </DialogDescription>
        </DialogHeader>

        {latest.isLoading ? (
          <div className="flex items-center justify-center py-10 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : digest ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl leading-snug font-semibold text-white">
              {digest.content.headline}
            </h2>

            <div className="flex flex-wrap items-center gap-1.5">
              {STAT_DEFS.map(({ key, label, Icon, accent }) => {
                const value = digest.content.stats[key];
                if (!value) return null;
                return (
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
                      accent
                        ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200/70"
                        : "border-white/10 bg-white/[0.03] text-white/60",
                    )}
                    key={key}
                  >
                    <Icon
                      className={cn(
                        "h-3 w-3",
                        accent ? "text-emerald-300/80" : "text-white/40",
                      )}
                    />
                    <span
                      className={cn(
                        "font-medium",
                        accent ? "text-emerald-200/90" : "text-white/80",
                      )}
                    >
                      {value}
                    </span>
                    {label}
                  </span>
                );
              })}
              {people.length > 0 ? (
                <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] py-0.5 pr-2 pl-1 text-xs text-white/60">
                  <span className="flex -space-x-1.5">
                    {people.slice(0, 5).map((p) => (
                      <UserAvatar
                        className="ring-2 ring-[#0f1016]"
                        image={imageById.get(p.id) ?? null}
                        key={p.id}
                        name={p.name}
                        size={18}
                      />
                    ))}
                  </span>
                  <span>
                    <span className="font-medium text-white/80">
                      {people.length}
                    </span>{" "}
                    {people.length === 1 ? "person" : "people"}
                  </span>
                </span>
              ) : null}
            </div>

            {activity.some((v) => v > 0) ? (
              <Sparkline data={activity} start={digest.periodStart} />
            ) : null}

            <FormattedSummary names={memberNames} text={digest.content.summary} />

            {groups.length > 0 ? (
              <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
                {groups.map((g) => (
                  <div className="flex flex-col gap-1.5" key={g.category}>
                    {showLabels ? (
                      <span
                        className={cn(
                          "text-[11px] font-medium tracking-wide uppercase",
                          g.category === "shipped"
                            ? "text-emerald-300/70"
                            : "text-white/35",
                        )}
                      >
                        {g.label}
                      </span>
                    ) : null}
                    <ul className="flex flex-col gap-1">
                      {g.items.map((h, i) => (
                        <HighlightRow
                          highlight={h}
                          image={
                            h.actor
                              ? (nameToImage.get(h.actor.toLowerCase()) ?? null)
                              : null
                          }
                          key={i}
                          onOpen={
                            h.taskId && onOpenTask
                              ? () => {
                                  onOpenTask(h.taskId!);
                                  onOpenChange(false);
                                }
                              : undefined
                          }
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
            No digest yet.
            {canWrite
              ? " Generate one to see what happened this week."
              : " Ask an editor to generate one."}
          </div>
        )}

        {digest || canWrite ? (
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-white/35">
              {digest ? `Generated ${formatRelative(digest.createdAt)}` : ""}
            </span>
            {canWrite ? (
              <Button
                disabled={generate.isPending}
                onClick={() => generate.mutate({ boardId })}
                size="sm"
                variant={digest ? "ghost" : "default"}
              >
                {generate.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : digest ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {digest ? "Regenerate" : "Generate this week"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
