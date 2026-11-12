import { ConnectedAppsSection } from "./_components/connected-apps-section";
import { DevicesSection } from "./_components/devices-section";
import { ProfileEditor } from "./_components/profile-editor";
import { api, HydrateClient } from "@/trpc/server";

export default function ProfilePage() {
  void api.user.me.prefetch();
  void api.device.list.prefetch();
  return (
    <HydrateClient>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">Profile</h1>
          <p className="text-muted-foreground text-sm">
            Your name and avatar, paired devices, and connected apps.
          </p>
        </header>
        <div className="flex flex-col gap-6">
          <ProfileEditor />
          <DevicesSection />
          <ConnectedAppsSection />
        </div>
      </div>
    </HydrateClient>
  );
}
