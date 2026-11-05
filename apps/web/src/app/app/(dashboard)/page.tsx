import { MyWork } from "@/app/app/_components/my-work";
import { ProjectsDashboard } from "@/app/app/_components/projects-dashboard";
import { PageContainer } from "@/components/ui/surface";
import { api, HydrateClient } from "@/trpc/server";

export default async function DashboardPage() {
  void api.today.list.prefetch();
  void api.user.myWork.prefetch();
  void api.project.list.prefetch();
  return (
    <HydrateClient>
      <PageContainer className="gap-12">
        <ProjectsDashboard />
        <MyWork />
      </PageContainer>
    </HydrateClient>
  );
}
