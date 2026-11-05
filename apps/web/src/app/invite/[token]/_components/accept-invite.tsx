"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/surface";
import { UserAvatar } from "@/components/ui/user-avatar";
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
      toast.success(`You joined ${projectName}`);
      router.replace(res.projectSlug ? `/app/p/${res.projectSlug}` : "/app");
    },
    onError: (e) => toast.error(e.message),
  });
  const decline = api.project.declineInvite.useMutation({
    onSuccess: () => setDeclined(true),
    onError: (e) => toast.error(e.message),
  });
  const busy = accept.isPending || decline.isPending || accept.isSuccess;
  const copy = ROLE_COPY[role] ?? { label: role, body: "" };

  if (declined) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-white/70">
          Invitation declined. You won&apos;t be added to {projectName}.
        </p>
        <Button asChild variant="outline">
          <Link href="/app">Go to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-white/70">You&apos;ll join as</span>
          <Badge className="text-xs font-medium" tone="neutral">
            {copy.label}
          </Badge>
        </div>
        {copy.body ? (
          <p className="mt-1.5 text-xs text-white/40">{copy.body}</p>
        ) : null}
      </Card>

      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => accept.mutate({ token })}
          size="lg"
        >
          {accept.isPending || accept.isSuccess
            ? "Joining…"
            : `Join ${projectName}`}
        </Button>
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => decline.mutate({ token })}
          variant="ghost"
        >
          {decline.isPending ? "Declining…" : "Decline"}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-white/10 pt-4 text-xs text-white/40">
        <UserAvatar image={image} name={name} size={18} />
        <span>
          Signed in as <span className="text-white">{email}</span>
        </span>
      </div>
    </div>
  );
}
