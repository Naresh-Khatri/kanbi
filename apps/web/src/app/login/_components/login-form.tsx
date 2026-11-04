"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { LastUsedBadge, useLastUsedAuth } from "@/components/auth/last-used";
import {
  AuthInviteBanner,
  InvitedEmailHint,
  inviteReturnPath,
} from "@/components/invite/auth-invite-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { oauthResumeUrl, preserveOAuthQuery } from "@/lib/oauth-flow";
import { authClient } from "@/server/better-auth/client";
import type { AuthInvite } from "@/server/invites";

export function LoginForm({
  providers,
  invite,
}: {
  providers: { github: boolean; google: boolean };
  invite: AuthInvite | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const [email, setEmail] = useState(invite?.email ?? "");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const { lastUsed, mark } = useLastUsedAuth();

  const providerNames = [
    providers.github ? "GitHub" : null,
    providers.google ? "Google" : null,
  ].filter((n): n is string => n !== null);
  const anySocial = providerNames.length > 0;
  const afterAuth = invite ? inviteReturnPath(invite) : "/app";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await authClient.signIn.email({ email, password });
    setPending(false);
    if (res.error) {
      toast.error(res.error.message ?? "Sign in failed");
      return;
    }
    mark("email");
    if (res.data?.url) {
      window.location.assign(res.data.url);
      return;
    }

    const resumeUrl = oauthResumeUrl(currentQuery);
    if (resumeUrl) {
      window.location.assign(resumeUrl);
      return;
    }

    if (invite) {
      // full nav -> invite page renders with the fresh session
      window.location.assign(afterAuth);
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  async function onGithub() {
    mark("github");
    await authClient.signIn.social({
      provider: "github",
      callbackURL: afterAuth,
    });
  }

  async function onGoogle() {
    mark("google");
    await authClient.signIn.social({
      provider: "google",
      callbackURL: afterAuth,
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#0b0b0f] to-[#15162c] px-6 text-white">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link className="flex items-center gap-2.5" href="/">
          <Logo className="h-8 w-8" />
          <span className="text-xl font-extrabold tracking-tight">Kanbi</span>
        </Link>
        {invite ? <AuthInviteBanner invite={invite} /> : null}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {invite ? "Sign in to accept" : "Sign in to Kanbi"}
          </h1>
          <p className="text-sm text-white/60">
            {invite
              ? "Sign in with the invited account, then confirm joining."
              : anySocial
                ? `Welcome back. Use email, or continue with ${providerNames.join(" or ")}.`
                : "Welcome back. Sign in with your email and password."}
          </p>
        </div>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              id="email"
              className={
                invite ? "cursor-not-allowed text-white/60" : undefined
              }
              onChange={(e) => setEmail(e.target.value)}
              readOnly={!!invite}
              required
              type="email"
              value={email}
            />
            {invite ? <InvitedEmailHint providers={providerNames} /> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                className="text-xs text-white/60 hover:text-white"
                href="/forgot-password"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              autoComplete="current-password"
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
          <div className="relative">
            {lastUsed === "email" && <LastUsedBadge />}
            <Button className="w-full" disabled={pending} type="submit">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </form>
        {anySocial && (
          <>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <div className="h-px flex-1 bg-white/10" />
              or
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <div className="flex gap-3">
              {providers.github && (
                <div className="relative flex-1">
                  {lastUsed === "github" && <LastUsedBadge />}
                  <Button
                    className="w-full"
                    onClick={onGithub}
                    variant="outline"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" className="h-4 w-4" src="/icons/github.svg" />
                    GitHub
                  </Button>
                </div>
              )}
              {providers.google && (
                <div className="relative flex-1">
                  {lastUsed === "google" && <LastUsedBadge />}
                  <Button
                    className="w-full"
                    onClick={onGoogle}
                    variant="outline"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" className="h-4 w-4" src="/icons/google.svg" />
                    Google
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
        <p className="text-center text-sm text-white/60">
          No account?{" "}
          <Link
            className="text-white underline"
            href={preserveOAuthQuery("/signup", currentQuery)}
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
