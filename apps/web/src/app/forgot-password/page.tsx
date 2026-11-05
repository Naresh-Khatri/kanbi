"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/ui/logo";
import { authClient } from "@/server/better-auth/client";
import { PageSubtitle, PageTitle } from "@/components/ui/surface";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (res.error) {
      toast.error(res.error.message ?? "Could not send reset email");
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/">
          <Wordmark />
        </Link>
        <div className="flex flex-col gap-1">
          <PageTitle>Forgot your password?</PageTitle>
          <PageSubtitle>
            Enter your email and we&apos;ll send you a reset link.
          </PageSubtitle>
        </div>
        {sent ? (
          <p className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-white">
            If an account exists for {email}, a reset link is on its way.
          </p>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <Button disabled={pending} type="submit">
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-white/70">
          <Link className="text-white underline" href="/login">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
