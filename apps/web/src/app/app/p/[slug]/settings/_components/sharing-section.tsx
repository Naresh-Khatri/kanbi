"use client";

import { Copy, Link as LinkIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { Section } from "./section";

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
  const create = api.share.create.useMutation({
    onSuccess: () => utils.share.list.invalidate({ boardId }),
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
          <div>
            <Button
              disabled={create.isPending}
              onClick={() => create.mutate({ boardId })}
              size="sm"
              variant="outline"
            >
              <LinkIcon className="h-4 w-4" /> Generate read-only link
            </Button>
          </div>
          {shares.length === 0 ? (
            <p className="text-xs text-white/50">No active share links.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/5 rounded-md border border-white/10">
              {shares.map((s) => (
                <li
                  className="flex items-center gap-2 px-3 py-2"
                  key={s.id}
                >
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
                    onClick={() => revoke.mutate({ boardId, shareId: s.id })}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}
