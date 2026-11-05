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
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/ui/logo";
import { oauthResumeUrl, preserveOAuthQuery } from "@/lib/oauth-flow";
import { authClient } from "@/server/better-auth/client";
import type { AuthInvite } from "@/server/invites";
import { PageSubtitle, PageTitle } from "@/components/ui/surface";

export function SignupForm({
  providers,
  invite,
}: {
  providers: { github: boolean; google: boolean };
  invite: AuthInvite | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const [name, setName] = useState("");
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
    const res = await authClient.signUp.email({ name, email, password });
    setPending(false);
    if (res.error) {
      toast.error(res.error.message ?? "Sign up failed");
      return;
    }
    mark("email");
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
    <AuthShell>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/">
          <Wordmark />
        </Link>
        {invite ? <AuthInviteBanner invite={invite} /> : null}
        <div className="flex flex-col gap-1">
          <PageTitle>
            {invite ? "Create an account to join" : "Create your account"}
          </PageTitle>
          <PageSubtitle>
            {invite
              ? "Takes about 20 seconds. You'll confirm joining right after."
              : anySocial
                ? `It takes about 20 seconds. Or continue with ${providerNames.join(" or ")}.`
                : "It takes about 20 seconds."}
          </PageSubtitle>
        </div>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              autoComplete="name"
              id="name"
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              readOnly={!!invite}
              required
              type="email"
              value={email}
            />
            {invite ? <InvitedEmailHint providers={providerNames} /> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
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
          <div className="relative">
            {lastUsed === "email" && <LastUsedBadge />}
            <Button className="w-full" disabled={pending} type="submit">
              {pending ? "Creating…" : "Create account"}
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
        <p className="text-center text-sm text-white/70">
          Already have an account?{" "}
          <Link
            className="text-white underline"
            href={preserveOAuthQuery("/login", currentQuery)}
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
