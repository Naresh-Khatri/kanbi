import { ConnectedAppsSection } from "@/app/app/(dashboard)/profile/_components/connected-apps-section";
import { DevicesSection } from "@/app/app/(dashboard)/profile/_components/devices-section";
import { ProfileEditor } from "@/app/app/(dashboard)/profile/profile-editor";
import { PageContainer } from "@/components/ui/surface";
import { api, HydrateClient } from "@/trpc/server";

export default function ProfilePage() {
  void api.user.me.prefetch();
  void api.device.list.prefetch();
  return (
    <HydrateClient>
      <PageContainer>
        <div className="max-w-xl">
          <ProfileEditor />
          <DevicesSection />
          <ConnectedAppsSection />
        </div>
      </PageContainer>
    </HydrateClient>
  );
}
