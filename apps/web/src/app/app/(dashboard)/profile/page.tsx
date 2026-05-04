import { DevicesSection } from "@/app/app/(dashboard)/profile/_components/devices-section";
import { ProfileEditor } from "@/app/app/(dashboard)/profile/profile-editor";
import { api, HydrateClient } from "@/trpc/server";

export default function ProfilePage() {
  void api.user.me.prefetch();
  void api.device.list.prefetch();
  return (
    <HydrateClient>
      <main className="mx-auto w-full max-w-xl px-6 py-10">
        <ProfileEditor />
        <DevicesSection />
      </main>
    </HydrateClient>
  );
}
