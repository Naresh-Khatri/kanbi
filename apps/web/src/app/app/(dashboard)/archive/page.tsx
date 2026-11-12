import { ArchivedProjects } from "@/app/app/_components/archived-projects";
import { api, HydrateClient } from "@/trpc/server";

export const metadata = { title: "Archived projects" };

export default function ArchivedProjectsPage() {
  void api.project.listArchived.prefetch();

  return (
    <HydrateClient>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">
            Archived projects
          </h1>
          <p className="text-muted-foreground text-sm">
            Kept out of your daily views until you need them again.
          </p>
        </header>
        <ArchivedProjects />
      </div>
    </HydrateClient>
  );
}
