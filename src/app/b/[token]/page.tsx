import { notFound } from "next/navigation";

import { PublicBoardView } from "@/app/b/[token]/_components/public-board-view";
import { api, HydrateClient } from "@/trpc/server";

export default async function PublicBoardPage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;
	const data = await api.share.getPublic({ token }).catch(() => null);
	if (!data) notFound();
	void api.share.getPublic.prefetch({ token });

	return (
		<HydrateClient>
			<PublicBoardView token={token} />
		</HydrateClient>
	);
}
