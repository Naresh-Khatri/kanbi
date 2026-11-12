"use client";

import { LinkIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
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
      toastManager.add({ type: "error", title: "Passwords don't match" });
      return;
    }
    setPending(true);
    const res = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);
    if (res.error) {
      toastManager.add({
        type: "error",
        title: res.error.message ?? "Reset failed",
      });
      return;
    }
    toastManager.add({
      type: "success",
      title: "Password updated",
      description: "Please sign in with your new password.",
    });
    router.push("/login");
  }

  if (!token || error) {
    return (
      <AuthShell>
        <Card className="w-full max-w-sm">
          <Empty className="p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LinkIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Link expired</EmptyTitle>
              <EmptyDescription>
                This reset link is invalid or has expired. Request a new one.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button render={<Link href="/forgot-password" />} variant="outline">
                Send a new link
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>Use at least 8 characters.</CardDescription>
        </CardHeader>
        <CardPanel>
          <Form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <Field name="password">
              <FieldLabel>New password</FieldLabel>
              <Input
                autoComplete="new-password"
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                required
                size="lg"
                type="password"
                value={password}
              />
              <FieldError match="tooShort">
                Use at least 8 characters.
              </FieldError>
            </Field>
            <Field name="confirm">
              <FieldLabel>Confirm password</FieldLabel>
              <Input
                autoComplete="new-password"
                minLength={8}
                onChange={(e) => setConfirm(e.target.value)}
                required
                size="lg"
                type="password"
                value={confirm}
              />
            </Field>
            <Button className="mt-2 w-full" loading={pending} size="lg" type="submit">
              Update password
            </Button>
          </Form>
        </CardPanel>
      </Card>
    </AuthShell>
  );
}
