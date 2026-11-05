"use client";

import { formatDate } from "@kanbi/shared";
import { Copy, Link as LinkIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
      expiresAt:
        expiryDays != null ? new Date(Date.now() + expiryDays * DAY_MS) : null,
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
        <p className="text-sm text-white/70">
          Only owners can manage public share links.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Link expiry"
              size="sm"
              onChange={(e) =>
                setExpiryDays(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              value={expiryDays ?? ""}
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.label} value={o.days ?? ""}>
                  {o.label}
                </option>
              ))}
            </Select>
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
            <p className="text-xs text-white/40">No active share links.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/10 rounded-md border border-white/10">
              {shares.map((s) => {
                const expired = s.expiresAt
                  ? new Date(s.expiresAt).getTime() <= Date.now()
                  : false;
                const exhausted = s.maxUses != null && s.usesCount >= s.maxUses;
                return (
                  <li className="flex flex-col gap-1 px-3 py-2" key={s.id}>
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-7 flex-1 text-xs"
                        readOnly
                        value={shareUrl(s.token)}
                      />
                      <Button
                        aria-label="Copy link"
                        onClick={() => {
                          navigator.clipboard.writeText(shareUrl(s.token));
                          toast.success("Link copied");
                        }}
                        size="icon-xs"
                        type="button"
                        variant="quiet"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        aria-label="Revoke link"
                        onClick={() =>
                          revoke.mutate({ boardId, shareId: s.id })
                        }
                        size="icon-xs"
                        type="button"
                        variant="quiet-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-2xs text-white/40">
                      {s.usesCount}
                      {s.maxUses != null ? ` / ${s.maxUses}` : ""} views
                      {s.expiresAt
                        ? ` · expires ${formatDate(s.expiresAt)}`
                        : " · no expiry"}
                      {expired ? (
                        <span className="text-danger"> · expired</span>
                      ) : exhausted ? (
                        <span className="text-danger"> · limit reached</span>
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
