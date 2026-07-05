"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { authClient } from "@/server/better-auth/client";

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
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#0b0b0f] to-[#15162c] px-6 text-white">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <Link className="flex items-center gap-2.5" href="/">
            <Logo className="h-8 w-8" />
            <span className="text-xl font-extrabold tracking-tight">Kanbi</span>
          </Link>
          <h1 className="text-2xl font-semibold">Link expired</h1>
          <p className="text-sm text-white/60">
            This reset link is invalid or has expired. Request a new one.
          </p>
          <Link className="text-white underline" href="/forgot-password">
            Send a new link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#0b0b0f] to-[#15162c] px-6 text-white">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link className="flex items-center gap-2.5" href="/">
          <Logo className="h-8 w-8" />
          <span className="text-xl font-extrabold tracking-tight">Kanbi</span>
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Choose a new password</h1>
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
    </main>
  );
}
