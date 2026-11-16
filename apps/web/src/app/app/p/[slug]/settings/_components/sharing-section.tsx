"use client";

import { formatDate } from "@kanbi/shared";
import { LinkIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";
import { LinkField } from "./link-field";
import { Section } from "./section";

const EXPIRY_ITEMS = [
  { label: "Never expires", value: "never" },
  { label: "Expires in 1 day", value: "1" },
  { label: "Expires in 7 days", value: "7" },
  { label: "Expires in 30 days", value: "30" },
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
  const [expiry, setExpiry] = useState("never");
  const [maxUses, setMaxUses] = useState("");
  const [includeImages, setIncludeImages] = useState(true);
  const create = api.share.create.useMutation({
    onSuccess: () => {
      setMaxUses("");
      void utils.share.list.invalidate({ boardId });
    },
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });
  const revoke = api.share.revoke.useMutation({
    onSuccess: () => utils.share.list.invalidate({ boardId }),
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });

  function shareUrl(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/b/${token}`;
  }

  function generate() {
    const parsed = Number.parseInt(maxUses, 10);
    const days = expiry === "never" ? null : Number(expiry);
    create.mutate({
      boardId,
      expiresAt: days != null ? new Date(Date.now() + days * DAY_MS) : null,
      maxUses: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      includeImages,
    });
  }

  return (
    <Section
      description="Generate a read-only public link. Anyone with the link can view the board, no sign-in needed. Image attachments can be included; other files never are."
      id="sharing"
      title="Sharing"
    >
      <CardPanel>
        {!isOwner ? (
          <p className="text-muted-foreground text-sm">
            Only owners can manage public share links.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                items={EXPIRY_ITEMS}
                onValueChange={(v) => setExpiry(v ?? "never")}
                value={expiry}
              >
                <SelectTrigger
                  aria-label="Link expiry"
                  className="w-auto"
                  size="sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {EXPIRY_ITEMS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <Input
                aria-label="Max views"
                className="w-28"
                min={1}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Max views"
                size="sm"
                type="number"
                value={maxUses}
              />
              <Label className="text-muted-foreground font-normal">
                <Switch
                  checked={includeImages}
                  onCheckedChange={setIncludeImages}
                />
                Include images
              </Label>
              <Button
                loading={create.isPending}
                onClick={generate}
                size="sm"
                variant="outline"
              >
                <LinkIcon aria-hidden="true" /> Generate link
              </Button>
            </div>
            {shares.length === 0 ? (
              <Empty className="rounded-xl border border-dashed py-8 md:py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <LinkIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle className="text-base">No active links</EmptyTitle>
                  <EmptyDescription>
                    Links you generate show up here, ready to copy or revoke.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {shares.map((s) => {
                  const expired = s.expiresAt
                    ? new Date(s.expiresAt).getTime() <= Date.now()
                    : false;
                  const exhausted =
                    s.maxUses != null && s.usesCount >= s.maxUses;
                  return (
                    <li className="flex flex-col gap-1.5" key={s.id}>
                      <LinkField
                        label="Share link"
                        onRemove={() =>
                          revoke.mutate({ boardId, shareId: s.id })
                        }
                        removeLabel="Revoke link"
                        removing={
                          revoke.isPending && revoke.variables?.shareId === s.id
                        }
                        url={shareUrl(s.token)}
                      />
                      <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="tabular-nums">
                          {s.usesCount}
                          {s.maxUses != null ? ` / ${s.maxUses}` : ""} views
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {s.expiresAt
                            ? `expires ${formatDate(s.expiresAt)}`
                            : "no expiry"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {s.includeImages ? "images shared" : "no images"}
                        </span>
                        {expired ? (
                          <Badge size="sm" variant="error">
                            Expired
                          </Badge>
                        ) : exhausted ? (
                          <Badge size="sm" variant="warning">
                            Limit reached
                          </Badge>
                        ) : null}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </CardPanel>
    </Section>
  );
}
