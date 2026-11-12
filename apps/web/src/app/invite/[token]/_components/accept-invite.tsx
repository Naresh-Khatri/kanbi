"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";

const ROLE_COPY: Record<string, { label: string; body: string }> = {
  editor: {
    label: "Editor",
    body: "Create, edit and move tasks, and work on the project's docs.",
  },
  viewer: {
    label: "Viewer",
    body: "See the board and docs, without making changes.",
  },
};

export function AcceptInvite({
  token,
  projectName,
  role,
  name,
  email,
  image,
}: {
  token: string;
  projectName: string;
  role: string;
  name: string;
  email: string;
  image: string | null;
}) {
  const router = useRouter();
  const [declined, setDeclined] = useState(false);

  const accept = api.project.acceptInvite.useMutation({
    onSuccess: (res) => {
      toastManager.add({ type: "success", title: `You joined ${projectName}` });
      router.replace(res.projectSlug ? `/app/p/${res.projectSlug}` : "/app");
    },
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });
  const decline = api.project.declineInvite.useMutation({
    onSuccess: () => setDeclined(true),
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });
  const busy = accept.isPending || decline.isPending || accept.isSuccess;
  const copy = ROLE_COPY[role] ?? { label: role, body: "" };

  if (declined) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-muted-foreground text-sm">
          Invitation declined. You won&apos;t be added to {projectName}.
        </p>
        <Button render={<Link href="/app" />} variant="outline">
          Go to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5 rounded-xl bg-muted px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">You&apos;ll join as</span>
          <Badge variant="outline">{copy.label}</Badge>
        </div>
        {copy.body ? (
          <p className="text-muted-foreground text-xs">{copy.body}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          disabled={decline.isPending}
          loading={accept.isPending || accept.isSuccess}
          onClick={() => accept.mutate({ token })}
          size="lg"
        >
          Join {projectName}
        </Button>
        <Button
          className="w-full"
          disabled={busy && !decline.isPending}
          loading={decline.isPending}
          onClick={() => decline.mutate({ token })}
          variant="ghost"
        >
          Decline
        </Button>
      </div>

      <Separator />
      <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
        <UserAvatar image={image} name={name} size={18} />
        <span>
          Signed in as <span className="text-foreground">{email}</span>
        </span>
      </div>
    </div>
  );
}
