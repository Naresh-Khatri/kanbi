"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/server/better-auth/client";

export function UserMenu({
	name,
	email,
	image,
}: {
	name: string;
	email: string;
	image: string | null;
}) {
	const router = useRouter();
	const initials = name
		.split(" ")
		.map((p) => p[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	async function onSignOut() {
		await authClient.signOut();
		router.push("/");
		router.refresh();
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-white/10 px-2 py-1 text-sm transition hover:bg-white/10">
				{image ? (
					// biome-ignore lint/performance/noImgElement: avatar url may be external
					<img alt="" className="h-6 w-6 rounded-full" src={image} />
				) : (
					<span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs">
						{initials || "?"}
					</span>
				)}
				<span className="pr-1">{name}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<div className="px-2 py-1.5 text-white/60 text-xs">{email}</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={onSignOut}>
					<LogOut className="h-4 w-4" /> Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
