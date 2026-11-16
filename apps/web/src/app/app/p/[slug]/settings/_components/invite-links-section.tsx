"use client";

import { formatDate } from "@kanbi/shared";
import { LinkIcon } from "lucide-react";
import { useState } from "react";

import { UserAvatar } from "@/components/user-avatar";
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
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";
import { LinkField } from "./link-field";
import { Section } from "./section";

type Role = "editor" | "viewer";

const ROLE_ITEMS: { value: Role; label: string }[] = [
  { value: "viewer", label: "Join as viewer" },
  { value: "editor", label: "Join as editor" },
];

const USES_ITEMS = [5, 10, 25, 50, 100].map((n) => ({
  value: String(n),
  label: `Up to ${n} people`,
}));

const EXPIRY_ITEMS = [
  { value: "1", label: "Expires in 1 day" },
  { value: "7", label: "Expires in 7 days" },
  { value: "30", label: "Expires in 30 days" },
];

const STATUS_BADGE = {
  expired: { label: "Expired", variant: "error" },
  full: { label: "Full", variant: "warning" },
} as const;

export function InviteLinksSection({ projectId }: { projectId: string }) {
  const utils = api.useUtils();
  const links = api.project.listInviteLinks.useQuery({ projectId }).data ?? [];
  const [role, setRole] = useState<Role>("viewer");
  const [maxUses, setMaxUses] = useState("10");
  const [expiry, setExpiry] = useState("7");

  const create = api.project.createInviteLink.useMutation({
    onSuccess: async (row) => {
      try {
        await navigator.clipboard.writeText(inviteUrl(row.token));
        toastManager.add({ type: "success", title: "Invite link copied" });
      } catch {
        toastManager.add({ type: "success", title: "Invite link created" });
      }
      await utils.project.listInviteLinks.invalidate({ projectId });
    },
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });
  const revoke = api.project.revokeInviteLink.useMutation({
    onSuccess: () => utils.project.listInviteLinks.invalidate({ projectId }),
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });

  return (
    <Section
      description="Share one link in a group chat. Anyone who opens it can create an account and join, until the link is full or expires."
      id="invite-links"
      title="Invite links"
    >
      <CardPanel>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <PlainSelect
              aria-label="Role for people joining"
              items={ROLE_ITEMS}
              onChange={(v) => setRole(v as Role)}
              value={role}
            />
            <PlainSelect
              aria-label="Join limit"
              items={USES_ITEMS}
              onChange={setMaxUses}
              value={maxUses}
            />
            <PlainSelect
              aria-label="Link expiry"
              items={EXPIRY_ITEMS}
              onChange={setExpiry}
              value={expiry}
            />
            <Button
              loading={create.isPending}
              onClick={() =>
                create.mutate({
                  projectId,
                  role,
                  maxUses: Number(maxUses),
                  expiresInDays: Number(expiry),
                })
              }
              size="sm"
              variant="outline"
            >
              <LinkIcon aria-hidden="true" /> Create link
            </Button>
          </div>

          {links.length === 0 ? (
            <Empty className="rounded-xl border border-dashed py-8 md:py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LinkIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-base">No invite links</EmptyTitle>
                <EmptyDescription>
                  Links you create show up here with who joined through them.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-4">
              {links.map((l) => {
                const badge =
                  l.status === "expired" || l.status === "full"
                    ? STATUS_BADGE[l.status]
                    : null;
                return (
                  <li className="flex flex-col gap-1.5" key={l.id}>
                    <LinkField
                      label="Invite link"
                      onRemove={() =>
                        revoke.mutate({ projectId, linkId: l.id })
                      }
                      removeLabel="Turn off link"
                      removing={
                        revoke.isPending && revoke.variables?.linkId === l.id
                      }
                      url={inviteUrl(l.token)}
                    />
                    <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="tabular-nums">
                        {l.usesCount} / {l.maxUses} joined
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{l.role}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {l.expiresAt
                          ? `expires ${formatDate(l.expiresAt)}`
                          : "no expiry"}
                      </span>
                      {badge ? (
                        <Badge size="sm" variant={badge.variant}>
                          {badge.label}
                        </Badge>
                      ) : null}
                      {l.joined.length > 0 ? (
                        <span className="flex items-center gap-1.5">
                          <span aria-hidden="true">·</span>
                          <span className="flex -space-x-1.5">
                            {l.joined.slice(0, 6).map((j) => (
                              <UserAvatar
                                className="ring-card ring-2"
                                image={j.image}
                                key={j.userId}
                                name={j.name}
                                size={18}
                              />
                            ))}
                          </span>
                          <span className="truncate">
                            {l.joined.map((j) => j.name).join(", ")}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardPanel>
    </Section>
  );
}

function inviteUrl(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/invite/${token}`;
}

function PlainSelect({
  items,
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
  "aria-label": string;
}) {
  return (
    <Select
      items={items}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
      value={value}
    >
      <SelectTrigger aria-label={ariaLabel} className="w-auto" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
