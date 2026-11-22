import {
  ArrowRightIcon,
  BotIcon,
  CommandIcon,
  SmartphoneIcon,
} from "lucide-react";
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
import type { AgentId } from "@/lib/agents";
import { getSession } from "@/server/better-auth/server";

import { AgentWheel } from "./_components/agent-wheel";
import { BoardPreview } from "./_components/board-preview";

const FEATURES = [
  {
    href: "/docs/mcp",
    Icon: BotIcon,
    title: "Built for agents",
    body: "Connect Claude Code, Codex, opencode or Grok over MCP. They pick up your tasks, ship the fix and report back on the card.",
    cta: "Connect an agent",
  },
  {
    href: "/signup",
    Icon: CommandIcon,
    title: "Fast when you drive",
    body: "Review agent work, triage and plan from the keyboard. ⌘K for everything, C to create.",
    cta: "Create account",
  },
  {
    href: "/docs/focus",
    Icon: SmartphoneIcon,
    title: "Focus companion app",
    body: "Pair your phone over a QR code and track tasks on the go.",
    cta: "Get started",
  },
] as const;

const SHOWCASE: AgentId[] = [
  "claude-code",
  "codex",
  "cursor",
  "antigravity",
  "copilot",
  "opencode",
  "amp",
];

export default async function Home() {
  const session = await getSession();
  if (session?.user) redirect("/app");

  return (
    <main className="relative isolate flex min-h-dvh flex-col">
      <div
        aria-hidden="true"
        className="from-foreground/7 pointer-events-none absolute inset-x-0 top-0 -z-10 h-160 bg-radial-[ellipse_at_50%_0%] to-transparent to-70%"
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
          <h1 className="font-heading max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            The kanban your{" "}
            <span className="whitespace-nowrap">
              <span className="sr-only">AI</span>
              <AgentWheel agents={SHOWCASE} /> agents
            </span>{" "}
            work from
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg text-pretty">
            Plan the work, assign it, and let your coding agent pick it up. It
            reads the brief, ships the fix and posts the result on the card for
            you to review.
          </p>
          <div className="mt-2 flex gap-3">
            <Button render={<Link href="/signup" />} size="lg">
              Create account
            </Button>
            <Button render={<Link href="/login" />} size="lg" variant="outline">
              Sign in
            </Button>
          </div>
        </section>
        <div className="mt-16 flex w-full justify-center">
          <BoardPreview />
        </div>
        <div className="mt-12 grid w-full max-w-5xl gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card
              className="hover:border-input"
              key={f.href}
              render={<Link href={f.href} />}
            >
              <CardHeader>
                <f.Icon
                  aria-hidden="true"
                  className="text-muted-foreground mb-2 size-5"
                />
                <CardTitle className="text-base">{f.title}</CardTitle>
                <CardDescription>{f.body}</CardDescription>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium">
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
