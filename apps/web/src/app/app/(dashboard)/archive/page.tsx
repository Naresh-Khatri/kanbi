import Link from "next/link";

import { ArchivedProjects } from "@/app/app/_components/archived-projects";
import { api, HydrateClient } from "@/trpc/server";

export default function ArchivedProjectsPage() {
  void api.project.listArchived.prefetch();

  return (
    <HydrateClient>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-1">
          <Link
            className="mb-2 w-fit text-xs text-white/50 transition hover:text-white/80"
            href="/app"
          >
            ← Projects
          </Link>
          <h1 className="text-2xl font-semibold">Archived projects</h1>
          <p className="text-sm text-white/60">
            Kept out of your daily views until you need them again.
          </p>
        </header>
        <ArchivedProjects />
      </main>
    </HydrateClient>
  );
}
