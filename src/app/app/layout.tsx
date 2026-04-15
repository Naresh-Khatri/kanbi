import Link from "next/link";
import { redirect } from "next/navigation";

import { UserMenu } from "@/app/app/_components/user-menu";
import { getSession } from "@/server/better-auth/server";

export default async function AppLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const session = await getSession();
	if (!session?.user) redirect("/login");

	return (
		<div className="flex min-h-screen flex-col">
			<header className="sticky top-0 z-40 flex items-center justify-between border-white/5 border-b bg-[#0b0b0f]/80 px-6 py-3 backdrop-blur">
				<Link className="font-semibold text-lg" href="/app">
					Kanbi
				</Link>
				<UserMenu
					email={session.user.email ?? ""}
					image={session.user.image ?? null}
					name={session.user.name ?? "You"}
				/>
			</header>
			<div className="flex-1">{children}</div>
		</div>
	);
}
