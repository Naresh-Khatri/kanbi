"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/ui/logo";
import { authClient } from "@/server/better-auth/client";
import { PageSubtitle, PageTitle } from "@/components/ui/surface";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const error = params.get("error");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setPending(true);
    const res = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);
    if (res.error) {
      toast.error(res.error.message ?? "Reset failed");
      return;
    }
    toast.success("Password updated. Please sign in.");
    router.push("/login");
  }

  if (!token || error) {
    return (
      <AuthShell>
        <div className="flex w-full max-w-sm flex-col gap-4">
          <Link href="/">
            <Wordmark />
          </Link>
          <PageTitle>Link expired</PageTitle>
          <PageSubtitle>
            This reset link is invalid or has expired. Request a new one.
          </PageSubtitle>
          <Link className="text-white underline" href="/forgot-password">
            Send a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/">
          <Wordmark />
        </Link>
        <div className="flex flex-col gap-1">
          <PageTitle>Choose a new password</PageTitle>
        </div>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              autoComplete="new-password"
              id="password"
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              autoComplete="new-password"
              id="confirm"
              minLength={8}
              onChange={(e) => setConfirm(e.target.value)}
              required
              type="password"
              value={confirm}
            />
          </div>
          <Button disabled={pending} type="submit">
            {pending ? "Saving…" : "Update password"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
