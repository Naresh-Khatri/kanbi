"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LastUsedBadge, useLastUsedAuth } from "@/components/auth/last-used";
import { SocialAuth, socialProviderNames } from "@/components/auth/social-auth";
import {
  AuthInviteBanner,
  InvitedEmailHint,
  inviteReturnPath,
} from "@/components/invite/auth-invite-banner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import { oauthResumeUrl, preserveOAuthQuery } from "@/lib/oauth-flow";
import {
  EXPIRED_PARAM,
  RETURN_URL_PARAM,
  safeReturnUrl,
  withReturnUrl,
} from "@/lib/return-url";
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

  const providerNames = socialProviderNames(providers);
  const afterAuth = invite
    ? inviteReturnPath(invite)
    : safeReturnUrl(searchParams.get(RETURN_URL_PARAM));
  const expired = !invite && searchParams.get(EXPIRED_PARAM) === "1";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await authClient.signIn.email({ email, password });
    setPending(false);
    if (res.error) {
      toastManager.add({
        type: "error",
        title: res.error.message ?? "Sign in failed",
      });
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
    router.replace(afterAuth);
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {invite
                ? invite.email
                  ? "Sign in to accept"
                  : "Sign in to join"
                : expired
                  ? "Session expired"
                  : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {invite
                ? invite.email
                  ? "Sign in with the invited account, then confirm joining."
                  : "Sign in with any account, then confirm joining."
                : expired
                  ? "Sign in again to pick up where you left off."
                  : "Sign in to your Kanbi account."}
            </CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-col gap-6">
            {invite ? <AuthInviteBanner invite={invite} /> : null}
            <SocialAuth
              callbackURL={afterAuth}
              lastUsed={lastUsed}
              mark={mark}
              providers={providers}
            />
            <Form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <Field name="email">
                <FieldLabel>Email</FieldLabel>
                <Input
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  readOnly={!!invite?.email}
                  required
                  size="lg"
                  type="email"
                  value={email}
                />
                {invite?.email ? (
                  <FieldDescription>
                    <InvitedEmailHint providers={providerNames} />
                  </FieldDescription>
                ) : null}
              </Field>
              <Field name="password">
                <div className="flex w-full items-center justify-between">
                  <FieldLabel>Password</FieldLabel>
                  <Link
                    className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                    href={withReturnUrl(
                      "/forgot-password",
                      searchParams.get(RETURN_URL_PARAM),
                    )}
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  size="lg"
                  type="password"
                  value={password}
                />
              </Field>
              <div className="relative mt-2">
                {lastUsed === "email" && <LastUsedBadge />}
                <Button
                  className="w-full"
                  loading={pending}
                  size="lg"
                  type="submit"
                >
                  Sign in
                </Button>
              </div>
            </Form>
          </CardPanel>
        </Card>
        <p className="text-muted-foreground text-center text-sm">
          No account?{" "}
          <Link
            className="text-foreground font-medium underline-offset-4 hover:underline"
            href={preserveOAuthQuery("/signup", currentQuery)}
          >
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
