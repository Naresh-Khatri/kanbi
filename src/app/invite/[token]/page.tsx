import { redirect } from "next/navigation";

import { AcceptInvite } from "@/app/invite/[token]/_components/accept-invite";
import { getSession } from "@/server/better-auth/server";

export default async function InvitePage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;
	const session = await getSession();
	if (!session?.user) {
		redirect(`/login?next=/invite/${encodeURIComponent(token)}`);
	}
	return (
		<main className="flex min-h-screen items-center justify-center px-6">
			<AcceptInvite token={token} />
		</main>
	);
}
