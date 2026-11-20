"use client";

import { MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import { loginUrl, RETURN_URL_PARAM, withReturnUrl } from "@/lib/return-url";
import { authClient } from "@/server/better-auth/client";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const returnUrl = useSearchParams().get(RETURN_URL_PARAM);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await authClient.requestPasswordReset({
      email,
      redirectTo: withReturnUrl("/reset-password", returnUrl),
    });
    setPending(false);
    if (res.error) {
      toastManager.add({
        type: "error",
        title: res.error.message ?? "Could not send reset email",
      });
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Forgot your password?</CardTitle>
            <CardDescription>
              Enter your email and we&apos;ll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardPanel>
            {sent ? (
              <Alert variant="success">
                <MailCheckIcon aria-hidden="true" />
                <AlertTitle>Check your inbox</AlertTitle>
                <AlertDescription>
                  If an account exists for {email}, a reset link is on its way.
                </AlertDescription>
              </Alert>
            ) : (
              <Form className="flex flex-col gap-4" onSubmit={onSubmit}>
                <Field name="email">
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    autoComplete="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    size="lg"
                    type="email"
                    value={email}
                  />
                </Field>
                <Button className="mt-2 w-full" loading={pending} size="lg" type="submit">
                  Send reset link
                </Button>
              </Form>
            )}
          </CardPanel>
        </Card>
        <p className="text-center text-muted-foreground text-sm">
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href={loginUrl(returnUrl)}
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
