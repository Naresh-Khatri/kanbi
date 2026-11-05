import { ArrowRight, Bot, Smartphone } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Logo, Wordmark } from "@/components/ui/logo";
import { Card } from "@/components/ui/surface";
import { BoardPreview } from "./_components/board-preview";
import { getSession } from "@/server/better-auth/server";

export default async function Home() {
  const session = await getSession();
  if (session?.user) redirect("/app");

  return (
    <main className="bg-marketing flex min-h-screen flex-col text-white">
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <Wordmark />
        <Button asChild size="sm" variant="quiet">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pt-16 pb-20 sm:pt-24">
        <section className="flex flex-col items-center gap-6 text-center">
          <Logo className="h-12 w-12" />
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            A fast, keyboard-first kanban for personal projects and small teams.
          </h1>
          <div className="mt-2 flex gap-3">
            <Button asChild shape="pill" size="lg">
              <Link href="/signup">Create account</Link>
            </Button>
            <Button asChild shape="pill" size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>
        <div className="mt-16 flex w-full justify-center">
          <BoardPreview />
        </div>
        <div className="mt-12 grid w-full max-w-4xl gap-3 sm:grid-cols-2">
          <Link href="/docs/focus">
            <Card
              as="div"
              className="group h-full text-left"
              interactive
              tone="muted"
            >
              <Smartphone className="h-5 w-5 text-white/70" />
              <h2 className="mt-3 font-semibold tracking-tight text-white">
                Focus companion app
              </h2>
              <p className="mt-1 text-sm text-white/70">
                Pair your phone over a QR code and track tasks on the go.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-white/40 transition group-hover:text-white">
                Get started
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Card>
          </Link>
          <Link href="/docs/mcp">
            <Card
              as="div"
              className="group h-full text-left"
              interactive
              tone="muted"
            >
              <Bot className="h-5 w-5 text-white/70" />
              <h2 className="mt-3 font-semibold tracking-tight text-white">
                MCP server
              </h2>
              <p className="mt-1 text-sm text-white/70">
                Let AI agents like Claude Code read and write your boards.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-white/40 transition group-hover:text-white">
                Connect an agent
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}
