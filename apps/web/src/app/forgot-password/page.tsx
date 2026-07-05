"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { authClient } from "@/server/better-auth/client";

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#0b0b0f] to-[#15162c] px-6 text-white">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link className="flex items-center gap-2.5" href="/">
          <Logo className="h-8 w-8" />
          <span className="text-xl font-extrabold tracking-tight">Kanbi</span>
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Forgot your password?</h1>
          <p className="text-sm text-white/60">
            Enter your email and we'll send you a reset link.
          </p>
        </div>
        {sent ? (
          <p className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-white/80">
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
        <p className="text-center text-sm text-white/60">
          <Link className="text-white underline" href="/login">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
