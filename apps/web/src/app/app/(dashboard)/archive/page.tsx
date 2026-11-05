import Link from "next/link";

import { ArchivedProjects } from "@/app/app/_components/archived-projects";
import { Button } from "@/components/ui/button";
import { api, HydrateClient } from "@/trpc/server";
import { PageTitle } from "@/components/ui/surface";

export default function ArchivedProjectsPage() {
  void api.project.listArchived.prefetch();

  return (
    <HydrateClient>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-1">
          <Button asChild className="mb-2 w-fit" size="inline" variant="link">
            <Link href="/app">← Projects</Link>
          </Button>
          <PageTitle>Archived projects</PageTitle>
          <p className="text-sm text-white/70">
            Kept out of your daily views until you need them again.
          </p>
        </header>
        <ArchivedProjects />
      </main>
    </HydrateClient>
  );
}
