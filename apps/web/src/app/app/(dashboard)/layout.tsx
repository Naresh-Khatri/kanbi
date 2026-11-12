import { AppHeader } from "@/app/app/_components/app-header";
import { DashboardBreadcrumb } from "@/app/app/_components/dashboard-breadcrumb";
import { api, HydrateClient } from "@/trpc/server";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  void api.user.me.prefetch();
  void api.project.list.prefetch();

  return (
    <HydrateClient>
      <AppHeader start={<DashboardBreadcrumb />} />
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </HydrateClient>
  );
}
