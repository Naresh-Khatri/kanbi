import { ArrowRightIcon, BotIcon, SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { getSession } from "@/server/better-auth/server";

import { BoardPreview } from "./_components/board-preview";

const FEATURES = [
  {
    href: "/docs/focus",
    Icon: SmartphoneIcon,
    title: "Focus companion app",
    body: "Pair your phone over a QR code and track tasks on the go.",
    cta: "Get started",
  },
  {
    href: "/docs/mcp",
    Icon: BotIcon,
    title: "MCP server",
    body: "Let AI agents like Claude Code read and write your boards.",
    cta: "Connect an agent",
  },
] as const;

export default async function Home() {
  const session = await getSession();
  if (session?.user) redirect("/app");

  return (
    <main className="relative isolate flex min-h-dvh flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-160 bg-radial-[ellipse_at_50%_0%] from-foreground/7 to-transparent to-70%"
      />
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Link aria-label="Kanbi home" className="rounded-md" href="/">
          <Wordmark />
        </Link>
        <Button render={<Link href="/login" />} variant="ghost">
          Sign in
        </Button>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pt-16 pb-24 sm:pt-24">
        <section className="flex flex-col items-center gap-6 text-center">
          <h1 className="max-w-3xl text-balance font-heading font-semibold text-4xl tracking-tight sm:text-6xl">
            A fast, keyboard-first kanban
          </h1>
          <p className="max-w-xl text-pretty text-lg text-muted-foreground">
            For personal projects and small teams. Capture, move and ship work
            without reaching for the mouse.
          </p>
          <div className="mt-2 flex gap-3">
            <Button render={<Link href="/signup" />} size="lg">
              Create account
            </Button>
            <Button render={<Link href="/login" />} size="lg" variant="outline">
              Sign in
            </Button>
          </div>
          <p className="flex items-center gap-2 text-muted-foreground text-xs">
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
            for everything,
            <Kbd>C</Kbd>
            to create
          </p>
        </section>
        <div className="mt-16 flex w-full justify-center">
          <BoardPreview />
        </div>
        <div className="mt-12 grid w-full max-w-4xl gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Card
              className="hover:border-input"
              key={f.href}
              render={<Link href={f.href} />}
            >
              <CardHeader>
                <f.Icon
                  aria-hidden="true"
                  className="mb-2 size-5 text-muted-foreground"
                />
                <CardTitle className="text-base">{f.title}</CardTitle>
                <CardDescription>{f.body}</CardDescription>
                <span className="mt-2 inline-flex items-center gap-1 font-medium text-sm">
                  {f.cta}
                  <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                </span>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
