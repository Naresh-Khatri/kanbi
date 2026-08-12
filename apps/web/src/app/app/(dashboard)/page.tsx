import { MyWork } from "@/app/app/_components/my-work";
import { ProjectsDashboard } from "@/app/app/_components/projects-dashboard";
import { api, HydrateClient } from "@/trpc/server";

export default async function DashboardPage() {
  void api.today.list.prefetch();
  void api.user.myWork.prefetch();
  void api.project.list.prefetch();
  return (
    <HydrateClient>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10">
        <ProjectsDashboard />
        <MyWork />
      </main>
    </HydrateClient>
  );
}
