"use client";

import { Card } from "@/components/ui/surface";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/server/better-auth/client";

export function SwitchAccount({
  token,
  invitedEmail,
  currentEmail,
}: {
  token: string;
  invitedEmail: string;
  currentEmail: string;
}) {
  const [pending, setPending] = useState(false);

  async function onSwitch() {
    setPending(true);
    const res = await authClient.signOut();
    if (res.error) {
      setPending(false);
      toast.error(res.error.message ?? "Couldn't sign out");
      return;
    }
    // full nav -> drop cached session; /invite re-routes to login/signup
    window.location.assign(`/invite/${encodeURIComponent(token)}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-2 text-sm" tone="warning">
        <p className="text-white">
          This invite was sent to{" "}
          <span className="font-medium text-white">{invitedEmail}</span>.
        </p>
        <p className="text-white/70">
          You&apos;re signed in as{" "}
          <span className="text-white">{currentEmail}</span>. Switch to the
          invited account to accept.
        </p>
      </Card>
      <Button className="w-full" disabled={pending} onClick={onSwitch}>
        {pending ? "Signing out…" : `Sign in as ${invitedEmail}`}
      </Button>
    </div>
  );
}
