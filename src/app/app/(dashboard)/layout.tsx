import { AppHeader } from "@/app/app/_components/app-header";
import { api, HydrateClient } from "@/trpc/server";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  void api.user.me.prefetch();

  return (
    <HydrateClient>
      <AppHeader />
      {children}
    </HydrateClient>
  );
}
