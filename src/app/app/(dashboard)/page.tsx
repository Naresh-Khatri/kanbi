import { ProjectsDashboard } from "@/app/app/_components/projects-dashboard";
import { api, HydrateClient } from "@/trpc/server";

export default async function DashboardPage() {
  void api.project.list.prefetch();
  return (
    <HydrateClient>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <ProjectsDashboard />
      </main>
    </HydrateClient>
  );
}
