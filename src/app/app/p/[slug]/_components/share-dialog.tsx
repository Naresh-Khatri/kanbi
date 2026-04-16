"use client";

import { Copy, Link as LinkIcon, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/trpc/react";

export function ShareDialog({
  boardId,
  projectId,
}: {
  boardId: string;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share board</DialogTitle>
          <DialogDescription>
            Invite collaborators, or generate a read-only link for anyone.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="invite">
          <TabsList>
            <TabsTrigger value="invite">Invite</TabsTrigger>
            <TabsTrigger value="link">Public link</TabsTrigger>
          </TabsList>
          <TabsContent value="invite">
            <InviteTab projectId={projectId} />
          </TabsContent>
          <TabsContent value="link">
            <PublicLinkTab boardId={boardId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function InviteTab({ projectId }: { projectId: string }) {
  const utils = api.useUtils();
  const invites = api.project.listInvites.useQuery({ projectId });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");

  const invite = api.project.invite.useMutation({
    onSuccess: async () => {
      setEmail("");
      await utils.project.listInvites.invalidate({ projectId });
    },
    onError: (e) => toast.error(e.message),
  });
  const revoke = api.project.revokeInvite.useMutation({
    onSuccess: () => utils.project.listInvites.invalidate({ projectId }),
  });

  function inviteUrl(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/invite/${token}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          invite.mutate({ projectId, email, role });
        }}
      >
        <Label htmlFor="invite-email">Invite by email</Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            required
            type="email"
            value={email}
          />
          <select
            className="rounded-md border border-white/10 bg-white/5 px-2 text-sm"
            onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
            value={role}
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <Button disabled={invite.isPending} type="submit">
            Invite
          </Button>
        </div>
        <p className="text-white/70 text-xs">
          We don't send email yet — copy the invite link below and pass it
          along.
        </p>
      </form>

      {(invites.data ?? []).length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label>Pending invites</Label>
          <ul className="flex flex-col gap-1">
            {(invites.data ?? [])
              .filter((i) => !i.acceptedAt)
              .map((i) => (
                <li
                  className="flex items-center gap-2 rounded-md border border-white/10 px-2 py-1.5 text-sm"
                  key={i.id}
                >
                  <span className="w-44 truncate">{i.email}</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-white/70 text-xs">
                    {i.role}
                  </span>
                  <button
                    className="flex-1 truncate text-left text-white/70 hover:text-white"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteUrl(i.token));
                      toast.success("Invite link copied");
                    }}
                    type="button"
                  >
                    copy link
                  </button>
                  <button
                    className="text-white/40 hover:text-white"
                    onClick={() => revoke.mutate({ projectId, inviteId: i.id })}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PublicLinkTab({ boardId }: { boardId: string }) {
  const utils = api.useUtils();
  const shares = api.share.list.useQuery({ boardId });
  const create = api.share.create.useMutation({
    onSuccess: () => utils.share.list.invalidate({ boardId }),
    onError: (e) => toast.error(e.message),
  });
  const revoke = api.share.revoke.useMutation({
    onSuccess: () => utils.share.list.invalidate({ boardId }),
  });

  function shareUrl(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/b/${token}`;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-white/70">
        Anyone with the link can view this board. No sign-in required. Links can
        be revoked.
      </p>
      <Button
        disabled={create.isPending}
        onClick={() => create.mutate({ boardId })}
        size="sm"
        variant="outline"
      >
        <LinkIcon className="h-4 w-4" /> Generate read-only link
      </Button>
      <ul className="flex flex-col gap-1">
        {(shares.data ?? []).map((s) => (
          <li
            className="flex items-center gap-2 rounded-md border border-white/10 px-2 py-1.5"
            key={s.id}
          >
            <input
              className="flex-1 rounded bg-white/5 px-2 py-1 text-xs"
              readOnly
              value={shareUrl(s.token)}
            />
            <button
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
              className="text-white/40 hover:text-white"
              onClick={() => revoke.mutate({ boardId, shareId: s.id })}
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
