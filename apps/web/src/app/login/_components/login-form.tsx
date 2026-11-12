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
  const afterAuth = invite ? inviteReturnPath(invite) : "/app";

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
    router.replace("/app");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {invite ? "Sign in to accept" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {invite
                ? "Sign in with the invited account, then confirm joining."
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
                  readOnly={!!invite}
                  required
                  size="lg"
                  type="email"
                  value={email}
                />
                {invite ? (
                  <FieldDescription>
                    <InvitedEmailHint providers={providerNames} />
                  </FieldDescription>
                ) : null}
              </Field>
              <Field name="password">
                <div className="flex w-full items-center justify-between">
                  <FieldLabel>Password</FieldLabel>
                  <Link
                    className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
                    href="/forgot-password"
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
                <Button className="w-full" loading={pending} size="lg" type="submit">
                  Sign in
                </Button>
              </div>
            </Form>
          </CardPanel>
        </Card>
        <p className="text-center text-muted-foreground text-sm">
          No account?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href={preserveOAuthQuery("/signup", currentQuery)}
          >
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
