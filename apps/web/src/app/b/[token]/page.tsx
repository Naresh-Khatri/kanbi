import type { Metadata } from "next";
import { cache } from "react";

import { PublicBoardView } from "@/app/b/[token]/_components/public-board-view";
import { ShareUnavailable } from "@/app/b/[token]/_components/share-unavailable";
import { api, HydrateClient } from "@/trpc/server";

const loadShare = cache((token: string) =>
  api.share.getPublic({ token }).catch(() => null),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await loadShare(token);
  // links are capability URLs -> never let them land in search results
  const robots = { index: false, follow: false };
  if (!data || data.status !== "ok") {
    return { title: "Shared board · Kanbi", robots };
  }
  const open = data.tasks.length;
  return {
    title: `${data.board.projectName} · Kanbi`,
    description:
      data.board.projectDescription ??
      `A read-only view of ${data.board.projectName} — ${open} task${open === 1 ? "" : "s"}.`,
    robots,
    referrer: "no-referrer",
  };
}

export default async function PublicBoardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadShare(token);
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
