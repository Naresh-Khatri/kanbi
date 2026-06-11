"use client";

import { formatDate } from "@kanbi/shared";
import { Copy, Link as LinkIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { Section } from "./section";

const EXPIRY_OPTIONS: { label: string; days: number | null }[] = [
  { label: "Never expires", days: null },
  { label: "Expires in 1 day", days: 1 },
  { label: "Expires in 7 days", days: 7 },
  { label: "Expires in 30 days", days: 30 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function SharingSection({
  boardId,
  isOwner,
}: {
  boardId: string;
  isOwner: boolean;
}) {
  const utils = api.useUtils();
  const shares =
    api.share.list.useQuery({ boardId }, { enabled: isOwner }).data ?? [];
  const [expiryDays, setExpiryDays] = useState<number | null>(null);
  const [maxUses, setMaxUses] = useState("");
  const create = api.share.create.useMutation({
    onSuccess: () => {
      setMaxUses("");
      utils.share.list.invalidate({ boardId });
    },
    onError: (e) => toast.error(e.message),
  });
  const revoke = api.share.revoke.useMutation({
    onSuccess: () => utils.share.list.invalidate({ boardId }),
    onError: (e) => toast.error(e.message),
  });

  function shareUrl(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/b/${token}`;
  }

  function generate() {
    const parsed = Number.parseInt(maxUses, 10);
    create.mutate({
      boardId,
      expiresAt: expiryDays != null ? new Date(Date.now() + expiryDays * DAY_MS) : null,
      maxUses: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
    });
  }

  return (
    <Section
      description="Generate a read-only public link. Anyone with the link can view the board — no sign-in needed."
      id="sharing"
      title="Sharing"
    >
      {!isOwner ? (
        <p className="text-sm text-white/60">
          Only owners can manage public share links.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Link expiry"
              className="h-8 rounded-md border border-white/10 bg-white/[0.03] px-2 text-sm text-white/80 outline-none focus:border-white/20"
              onChange={(e) =>
                setExpiryDays(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              value={expiryDays ?? ""}
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option className="bg-[#0f1016]" key={o.label} value={o.days ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
            <Input
              aria-label="Max views"
              className="h-8 w-28"
              min={1}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Max views"
              type="number"
              value={maxUses}
            />
            <Button
              disabled={create.isPending}
              onClick={generate}
              size="sm"
              variant="outline"
            >
              <LinkIcon className="h-4 w-4" /> Generate link
            </Button>
          </div>
          {shares.length === 0 ? (
            <p className="text-xs text-white/50">No active share links.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/5 rounded-md border border-white/10">
              {shares.map((s) => {
                const expired = s.expiresAt
                  ? new Date(s.expiresAt).getTime() <= Date.now()
                  : false;
                const exhausted =
                  s.maxUses != null && s.usesCount >= s.maxUses;
                return (
                  <li className="flex flex-col gap-1 px-3 py-2" key={s.id}>
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 rounded bg-white/5 px-2 py-1 text-xs text-white/80"
                        readOnly
                        value={shareUrl(s.token)}
                      />
                      <button
                        aria-label="Copy link"
                        className="text-white/70 hover:text-white"
                        onClick={() => {
                          navigator.clipboard.writeText(shareUrl(s.token));
                          toast.success("Link copied");
                        }}
                        type="button"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label="Revoke link"
                        className="text-white/40 hover:text-red-400"
                        onClick={() =>
                          revoke.mutate({ boardId, shareId: s.id })
                        }
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-white/40">
                      {s.usesCount}
                      {s.maxUses != null ? ` / ${s.maxUses}` : ""} views
                      {s.expiresAt
                        ? ` · expires ${formatDate(s.expiresAt)}`
                        : " · no expiry"}
                      {expired ? (
                        <span className="text-red-400/80"> · expired</span>
                      ) : exhausted ? (
                        <span className="text-red-400/80"> · limit reached</span>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}
