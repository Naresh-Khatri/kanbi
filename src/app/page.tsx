import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/ui/logo";
import { getSession } from "@/server/better-auth/server";

export default async function Home() {
  const session = await getSession();
  if (session?.user) redirect("/app");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-[#0b0b0f] to-[#15162c] px-6 text-white">
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
        <Link
          className="rounded-full bg-white px-6 py-2.5 font-medium text-black transition hover:bg-white/90"
          href="/login"
        >
          Sign in
        </Link>
        <Link
          className="rounded-full border border-white/20 px-6 py-2.5 font-medium transition hover:bg-white/10"
          href="/signup"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
