import { ArrowRight, Bot, Smartphone } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { getSession } from "@/server/better-auth/server";

export default async function Home() {
  const session = await getSession();
  if (session?.user) redirect("/app");

  return (
    <main className="bg-marketing flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-white">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex gap-4">
          <Logo className="h-18 w-18 pb-2" />
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
            Kanbi
          </h1>
        </div>
        <p className="max-w-md text-lg text-white/70">
          A fast, keyboard-first kanban for personal projects and small teams.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild shape="pill" size="lg">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild shape="pill" size="lg" variant="outline">
          <Link href="/signup">Create account</Link>
        </Button>
      </div>
      <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
        <Link
          className="group rounded-lg border border-white/10 bg-white/5 p-5 text-left transition hover:bg-white/10"
          href="/docs/focus"
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
        </Link>
        <Link
          className="group rounded-lg border border-white/10 bg-white/5 p-5 text-left transition hover:bg-white/10"
          href="/docs/mcp"
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
        </Link>
      </div>
    </main>
  );
}
