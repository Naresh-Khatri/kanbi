"use client";

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
      <div className="flex flex-col gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm">
        <p className="text-white/80">
          This invite was sent to{" "}
          <span className="font-medium text-white">{invitedEmail}</span>.
        </p>
        <p className="text-white/60">
          You&apos;re signed in as{" "}
          <span className="text-white/80">{currentEmail}</span>. Switch to the
          invited account to accept.
        </p>
      </div>
      <Button className="w-full" disabled={pending} onClick={onSwitch}>
        {pending ? "Signing out…" : `Sign in as ${invitedEmail}`}
      </Button>
    </div>
  );
}
