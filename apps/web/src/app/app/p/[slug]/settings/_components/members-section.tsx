"use client";

import { Check, ChevronDown, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/user-avatar";
import { api } from "@/trpc/react";
import { Section } from "./section";

type Role = "owner" | "editor" | "viewer";

const ROLE_RANK: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };

export function MembersSection({
  projectId,
  slug,
  isOwner,
}: {
  projectId: string;
  slug: string;
  isOwner: boolean;
}) {
  const utils = api.useUtils();
  const members = api.project.members.useQuery({ projectId }).data ?? [];
  const invites =
    api.project.listInvites.useQuery({ projectId }, { enabled: isOwner })
      .data ?? [];

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");

  const invite = api.project.invite.useMutation({
    onSuccess: async () => {
      setEmail("");
      toast.success("Invite sent");
      await utils.project.listInvites.invalidate({ projectId });
    },
    onError: (e) => toast.error(e.message),
  });
  const revoke = api.project.revokeInvite.useMutation({
    onSuccess: () => utils.project.listInvites.invalidate({ projectId }),
    onError: (e) => toast.error(e.message),
  });
  const setMemberRole = api.project.setMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      return utils.project.members.invalidate({ projectId });
    },
    onError: (e) => toast.error(e.message),
  });
  const removeMember = api.project.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed");
      return utils.project.members.invalidate({ projectId });
    },
    onError: (e) => toast.error(e.message),
  });

  const sorted = [...members].sort((a, b) => {
    const r = ROLE_RANK[a.role as Role] - ROLE_RANK[b.role as Role];
    return r !== 0 ? r : a.name.localeCompare(b.name);
  });

  function inviteUrl(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/invite/${token}`;
  }

  return (
    <Section
      description={
        isOwner
          ? "Invite collaborators by email. They'll get a link to join."
          : "People with access to this project."
      }
      id="members"
      title="Members"
    >
      <div className="flex flex-col gap-6">
        {isOwner ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate({ projectId, email, role });
            }}
          >
            <Label htmlFor={`invite-email-${slug}`}>Invite by email</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={`invite-email-${slug}`}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                required
                type="email"
                value={email}
              />
              <RoleDropdown onChange={setRole} value={role} />
              <Button disabled={invite.isPending} type="submit">
                {invite.isPending ? "Sending…" : "Send invite"}
              </Button>
            </div>
          </form>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label>
            {members.length} member{members.length === 1 ? "" : "s"}
          </Label>
          <ul className="flex flex-col divide-y divide-white/10 rounded-md border border-white/10">
            {sorted.map((m) => {
              const editable = isOwner && m.role !== "owner";
              const busy =
                (setMemberRole.isPending &&
                  setMemberRole.variables?.userId === m.userId) ||
                (removeMember.isPending &&
                  removeMember.variables?.userId === m.userId);
              return (
                <li
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                  key={m.userId}
                >
                  <UserAvatar image={m.image} name={m.name} size={28} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{m.name}</span>
                    <span className="truncate text-xs text-white/40">
                      {m.email}
                    </span>
                  </div>
                  {editable ? (
                    <RoleDropdown
                      ariaLabel={`Role for ${m.name}`}
                      disabled={busy}
                      onChange={(next) =>
                        setMemberRole.mutate({
                          projectId,
                          userId: m.userId,
                          role: next,
                        })
                      }
                      size="sm"
                      value={m.role as "editor" | "viewer"}
                    />
                  ) : (
                    <span className="text-xs text-white/70 capitalize">
                      {m.role}
                    </span>
                  )}
                  {editable ? (
                    <Button
                      aria-label={`Remove ${m.name}`}
                      disabled={busy}
                      onClick={() =>
                        removeMember.mutate({ projectId, userId: m.userId })
                      }
                      size="icon-xs"
                      type="button"
                      variant="quiet-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        {isOwner && invites.filter((i) => !i.acceptedAt).length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label>Pending invites</Label>
            <ul className="flex flex-col divide-y divide-white/10 rounded-md border border-white/10">
              {invites
                .filter((i) => !i.acceptedAt)
                .map((i) => (
                  <li
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                    key={i.id}
                  >
                    <span className="min-w-0 flex-1 truncate">{i.email}</span>
                    <Badge className="capitalize">{i.role}</Badge>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(inviteUrl(i.token));
                        toast.success("Invite link copied");
                      }}
                      size="inline"
                      type="button"
                      variant="link"
                    >
                      copy link
                    </Button>
                    <Button
                      aria-label="Revoke invite"
                      onClick={() =>
                        revoke.mutate({ projectId, inviteId: i.id })
                      }
                      size="icon-xs"
                      type="button"
                      variant="quiet-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

const ROLE_OPTIONS: { value: "editor" | "viewer"; label: string }[] = [
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

function RoleDropdown({
  value,
  onChange,
  disabled,
  size = "md",
  ariaLabel,
}: {
  value: "editor" | "viewer";
  onChange: (next: "editor" | "viewer") => void;
  disabled?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const current = ROLE_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={ariaLabel}
          className="justify-between"
          disabled={disabled}
          size={size === "sm" ? "xs" : "default"}
          type="button"
          variant="outline"
        >
          <span>{current}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-28">
        {ROLE_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => onChange(opt.value)}
          >
            <Check
              className={`h-3.5 w-3.5 ${opt.value === value ? "opacity-100" : "opacity-0"}`}
            />
            <span>{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
