import { PublicBoardView } from "@/app/b/[token]/_components/public-board-view";
import { ShareUnavailable } from "@/app/b/[token]/_components/share-unavailable";
import { api, HydrateClient } from "@/trpc/server";

export default async function PublicBoardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await api.share.getPublic({ token }).catch(() => null);
  if (!data || data.status !== "ok") {
    return <ShareUnavailable status={data?.status ?? "not_found"} />;
  }

  // Hydrate the valid snapshot first, then count exactly one view for this load
  // (getPublic itself no longer increments, so prefetch/suspense stay free).
  await api.share.getPublic.prefetch({ token });
  await api.share.recordView({ token }).catch(() => {});

  return (
    <HydrateClient>
      <PublicBoardView token={token} />
    </HydrateClient>
  );
}
