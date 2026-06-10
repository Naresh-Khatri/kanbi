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
import type { DigestHighlight } from "@/server/db/schema";
import { api } from "@/trpc/react";

type Member = { userId: string; name: string | null; image: string | null };

const STAT_DEFS = [
  { key: "created", label: "created", Icon: Plus },
  { key: "moved", label: "moved", Icon: ArrowRight },
  { key: "completed", label: "completed", Icon: CheckCircle2 },
  { key: "comments", label: "comments", Icon: MessageSquare },
] as const;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function periodLabel(start: Date | string, end: Date | string) {
  const fmt = (d: Date | string) =>
    new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function normalizeHighlights(raw: unknown): DigestHighlight[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((h) =>
    typeof h === "string"
      ? { actor: null, action: h, task: null }
      : (h as DigestHighlight),
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

export function DigestPanel({
  boardId,
  open,
  onOpenChange,
  canWrite,
  members,
}: {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  members: Member[];
}) {
  const utils = api.useUtils();
  const latest = api.digest.latest.useQuery({ boardId }, { enabled: open });
  const generate = api.digest.generate.useMutation({
    onSuccess: () => utils.digest.latest.invalidate({ boardId }),
    onError: (e) => toast.error(e.message),
  });

  const { idToImage, nameToImage, memberNames } = useMemo(() => {
    const idToImage = new Map<string, string | null>();
    const nameToImage = new Map<string, string | null>();
    const memberNames: string[] = [];
    for (const m of members) {
      idToImage.set(m.userId, m.image);
      if (m.name) {
        nameToImage.set(m.name.toLowerCase(), m.image);
        memberNames.push(m.name);
      }
    }
    return { idToImage, nameToImage, memberNames };
  }, [members]);

  const digest = latest.data;
  const highlights = digest ? normalizeHighlights(digest.content.highlights) : [];
  const people = digest?.content.people ?? [];

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
                {periodLabel(digest.periodStart, digest.periodEnd)}
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
              {STAT_DEFS.map(({ key, label, Icon }) => {
                const value = digest.content.stats[key];
                if (!value) return null;
                return (
                  <span
                    className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs text-white/60"
                    key={key}
                  >
                    <Icon className="h-3 w-3 text-white/40" />
                    <span className="font-medium text-white/80">{value}</span>
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
                        image={idToImage.get(p.id) ?? null}
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

            <FormattedSummary names={memberNames} text={digest.content.summary} />

            {highlights.length > 0 ? (
              <ul className="flex flex-col gap-2.5 border-t border-white/5 pt-4">
                {highlights.map((h, i) => (
                  <li className="flex items-start gap-2.5" key={i}>
                    {h.actor ? (
                      <UserAvatar
                        className="mt-0.5"
                        image={nameToImage.get(h.actor.toLowerCase()) ?? null}
                        name={h.actor}
                        size={22}
                      />
                    ) : (
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                    )}
                    <p className="text-sm leading-relaxed text-white/55">
                      {h.actor ? (
                        <span className="font-medium text-white/90">
                          {h.actor}{" "}
                        </span>
                      ) : null}
                      {h.action}
                      {h.task ? (
                        <span className="font-medium text-white/90">
                          {" "}
                          “{h.task}”
                        </span>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
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

        {canWrite ? (
          <div className="flex justify-end">
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
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
