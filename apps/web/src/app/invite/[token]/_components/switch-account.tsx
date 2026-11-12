"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
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
      toastManager.add({
        type: "error",
        title: res.error.message ?? "Couldn't sign out",
      });
      return;
    }
    // full nav -> drop cached session; /invite re-routes to login/signup
    window.location.assign(`/invite/${encodeURIComponent(token)}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <Alert variant="warning">
        <TriangleAlertIcon aria-hidden="true" />
        <AlertTitle>
          This invite was sent to{" "}
          <span className="font-semibold">{invitedEmail}</span>
        </AlertTitle>
        <AlertDescription>
          <p>
            You&apos;re signed in as{" "}
            <span className="text-foreground">{currentEmail}</span>. Switch to
            the invited account to accept.
          </p>
        </AlertDescription>
      </Alert>
      <Button className="w-full" loading={pending} onClick={onSwitch} size="lg">
        Sign in as {invitedEmail}
      </Button>
    </div>
  );
}
