"use client";

import {
  EllipsisIcon,
  LinkIcon,
  MailIcon,
  Trash2Icon,
  UserMinusIcon,
} from "lucide-react";
import { useState } from "react";

import { UserAvatar } from "@/components/user-avatar";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";
import { Section } from "./section";

type Role = "owner" | "editor" | "viewer";
type AssignableRole = Exclude<Role, "owner">;

const ROLE_RANK: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };

const ROLE_ITEMS: { value: AssignableRole; label: string }[] = [
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

// full-bleed rows inside the card: align first/last cells with card padding
const TABLE_EDGE = "[&_tr>*:first-child]:ps-6 [&_tr>*:last-child]:pe-6";

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
  const pending = invites.filter((i) => !i.acceptedAt);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("editor");
  const [removing, setRemoving] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const invite = api.project.invite.useMutation({
    onSuccess: async () => {
      setEmail("");
      toastManager.add({ type: "success", title: "Invite sent" });
      await utils.project.listInvites.invalidate({ projectId });
    },
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });
  const revoke = api.project.revokeInvite.useMutation({
    onSuccess: () => utils.project.listInvites.invalidate({ projectId }),
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });
  const setMemberRole = api.project.setMemberRole.useMutation({
    onSuccess: () => {
      toastManager.add({ type: "success", title: "Role updated" });
      return utils.project.members.invalidate({ projectId });
    },
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });
  const removeMember = api.project.removeMember.useMutation({
    onSuccess: () => {
      toastManager.add({ type: "success", title: "Member removed" });
      setRemoving(null);
      return utils.project.members.invalidate({ projectId });
    },
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });

  const sorted = [...members].sort((a, b) => {
    const r = ROLE_RANK[a.role as Role] - ROLE_RANK[b.role as Role];
    return r !== 0 ? r : a.name.localeCompare(b.name);
  });

  function inviteUrl(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/invite/${token}`;
  }

  async function copyInvite(token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      toastManager.add({ type: "success", title: "Invite link copied" });
    } catch {
      toastManager.add({ type: "error", title: "Couldn't copy" });
    }
  }

  return (
    <Section
      action={
        <Badge variant="outline">
          {members.length} member{members.length === 1 ? "" : "s"}
        </Badge>
      }
      description={
        isOwner
          ? "Invite collaborators by email. They'll get a link to join."
          : "People with access to this project."
      }
      className="overflow-hidden"
      id="members"
      title="Members"
    >
      {isOwner ? (
        <CardPanel>
          <Form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate({ projectId, email, role });
            }}
          >
            <Field className="flex-1" name="email">
              <FieldLabel>Invite by email</FieldLabel>
              <Input
                id={`invite-email-${slug}`}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                required
                type="email"
                value={email}
              />
            </Field>
            <div className="flex gap-2">
              <RoleSelect
                aria-label="Role for invite"
                onChange={setRole}
                value={role}
              />
              <Button loading={invite.isPending} type="submit">
                <MailIcon aria-hidden="true" />
                Send invite
              </Button>
            </div>
          </Form>
        </CardPanel>
      ) : null}

      <Table className={TABLE_EDGE} render={<div className="mt-2 border-t" />}>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead className="w-32">Role</TableHead>
            {isOwner ? (
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((m) => {
            const editable = isOwner && m.role !== "owner";
            const busy =
              (setMemberRole.isPending &&
                setMemberRole.variables?.userId === m.userId) ||
              (removeMember.isPending &&
                removeMember.variables?.userId === m.userId);
            return (
              <TableRow key={m.userId}>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar image={m.image} name={m.name} size={28} />
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate font-medium">{m.name}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {m.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {editable ? (
                    <RoleSelect
                      aria-label={`Role for ${m.name}`}
                      disabled={busy}
                      onChange={(next) =>
                        setMemberRole.mutate({
                          projectId,
                          userId: m.userId,
                          role: next,
                        })
                      }
                      size="sm"
                      value={m.role as AssignableRole}
                    />
                  ) : (
                    <Badge
                      className="capitalize"
                      variant={m.role === "owner" ? "secondary" : "outline"}
                    >
                      {m.role}
                    </Badge>
                  )}
                </TableCell>
                {isOwner ? (
                  <TableCell className="text-end">
                    {editable ? (
                      <Menu>
                        <MenuTrigger
                          render={
                            <Button
                              aria-label={`Actions for ${m.name}`}
                              disabled={busy}
                              size="icon-sm"
                              variant="ghost"
                            />
                          }
                        >
                          <EllipsisIcon aria-hidden="true" />
                        </MenuTrigger>
                        <MenuPopup align="end">
                          <MenuItem
                            onClick={() =>
                              setRemoving({ userId: m.userId, name: m.name })
                            }
                            variant="destructive"
                          >
                            <UserMinusIcon aria-hidden="true" />
                            Remove from project
                          </MenuItem>
                        </MenuPopup>
                      </Menu>
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {isOwner && pending.length > 0 ? (
        <Table className={TABLE_EDGE} render={<div className="border-t" />}>
          <TableHeader>
            <TableRow>
              <TableHead>Pending invites</TableHead>
              <TableHead className="w-32">Role</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="max-w-0 truncate">{i.email}</TableCell>
                <TableCell>
                  <Badge className="capitalize" variant="outline">
                    {i.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <Menu>
                    <MenuTrigger
                      render={
                        <Button
                          aria-label={`Actions for invite to ${i.email}`}
                          size="icon-sm"
                          variant="ghost"
                        />
                      }
                    >
                      <EllipsisIcon aria-hidden="true" />
                    </MenuTrigger>
                    <MenuPopup align="end">
                      <MenuItem onClick={() => void copyInvite(i.token)}>
                        <LinkIcon aria-hidden="true" />
                        Copy invite link
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        onClick={() =>
                          revoke.mutate({ projectId, inviteId: i.id })
                        }
                        variant="destructive"
                      >
                        <Trash2Icon aria-hidden="true" />
                        Revoke invite
                      </MenuItem>
                    </MenuPopup>
                  </Menu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        open={removing !== null}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to this project right away. You can invite them
              again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>
              Cancel
            </AlertDialogClose>
            <Button
              loading={removeMember.isPending}
              onClick={() => {
                if (removing)
                  removeMember.mutate({ projectId, userId: removing.userId });
              }}
              variant="destructive"
            >
              Remove member
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </Section>
  );
}

function RoleSelect({
  value,
  onChange,
  disabled,
  size = "default",
  "aria-label": ariaLabel,
}: {
  value: AssignableRole;
  onChange: (next: AssignableRole) => void;
  disabled?: boolean;
  size?: "sm" | "default";
  "aria-label": string;
}) {
  return (
    <Select
      disabled={disabled}
      items={ROLE_ITEMS}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      value={value}
    >
      <SelectTrigger aria-label={ariaLabel} className="min-w-28" size={size}>
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {ROLE_ITEMS.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
