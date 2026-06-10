"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/trpc/react";

const STAT_LABELS: { key: string; label: string }[] = [
  { key: "created", label: "created" },
  { key: "moved", label: "moved" },
  { key: "completed", label: "completed" },
  { key: "comments", label: "comments" },
  { key: "contributors", label: "people" },
];

function periodLabel(start: Date | string, end: Date | string) {
  const fmt = (d: Date | string) =>
    new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function DigestPanel({
  boardId,
  open,
  onOpenChange,
  canWrite,
}: {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
}) {
  const utils = api.useUtils();
  const latest = api.digest.latest.useQuery(
    { boardId },
    { enabled: open },
  );
  const generate = api.digest.generate.useMutation({
    onSuccess: () => utils.digest.latest.invalidate({ boardId }),
    onError: (e) => toast.error(e.message),
  });

  const digest = latest.data;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-white/60" />
            Weekly digest
          </DialogTitle>
          <DialogDescription>
            An AI standup of the last 7 days, mined from board activity.
          </DialogDescription>
        </DialogHeader>

        {latest.isLoading ? (
          <div className="flex items-center justify-center py-10 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : digest ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-medium text-white/90">
                {digest.content.headline}
              </h3>
              <span className="text-xs text-white/40">
                {periodLabel(digest.periodStart, digest.periodEnd)}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {STAT_LABELS.map(({ key, label }) => {
                const value =
                  digest.content.stats[key as keyof typeof digest.content.stats];
                if (!value) return null;
                return (
                  <span
                    className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs text-white/60"
                    key={key}
                  >
                    <span className="font-medium text-white/80">{value}</span>{" "}
                    {label}
                  </span>
                );
              })}
            </div>

            <p className="text-sm leading-relaxed text-white/70">
              {digest.content.summary}
            </p>

            {digest.content.highlights.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {digest.content.highlights.map((h, i) => (
                  <li
                    className="flex gap-2 text-sm text-white/70"
                    key={i}
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/30" />
                    <span>{h}</span>
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
