"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { LastUsedBadge, useLastUsedAuth } from "@/components/auth/last-used";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/logo";
import { authClient } from "@/server/better-auth/client";

export function SignupForm({
  providers,
}: {
  providers: { github: boolean; google: boolean };
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const { lastUsed, mark } = useLastUsedAuth();

  const providerNames = [
    providers.github ? "GitHub" : null,
    providers.google ? "Google" : null,
  ].filter((n): n is string => n !== null);
  const anySocial = providerNames.length > 0;

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
    router.push("/app");
    router.refresh();
  }

  async function onGithub() {
    mark("github");
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/app",
    });
  }

  async function onGoogle() {
    mark("google");
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/app",
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#0b0b0f] to-[#15162c] px-6 text-white">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link className="flex items-center gap-2.5" href="/">
          <Logo className="h-8 w-8" />
          <span className="text-xl font-extrabold tracking-tight">Kanbi</span>
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="text-sm text-white/60">
            {anySocial
              ? `It takes about 20 seconds. Or continue with ${providerNames.join(" or ")}.`
              : "It takes about 20 seconds."}
          </p>
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
              required
              type="email"
              value={email}
            />
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
        <p className="text-center text-sm text-white/60">
          Already have an account?{" "}
          <Link className="text-white underline" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
