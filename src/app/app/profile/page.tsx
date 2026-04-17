import { ProfileEditor } from "@/app/app/profile/profile-editor";
import { api, HydrateClient } from "@/trpc/server";

export default async function ProfilePage() {
  void api.user.me.prefetch();
  return (
    <HydrateClient>
      <main className="mx-auto w-full max-w-xl px-6 py-10">
        <ProfileEditor />
      </main>
    </HydrateClient>
  );
}
