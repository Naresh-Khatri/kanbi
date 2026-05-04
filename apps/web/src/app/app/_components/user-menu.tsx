"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { authClient } from "@/server/better-auth/client";
import { api } from "@/trpc/react";

export function UserMenu() {
  const router = useRouter();
  const me = api.user.me.useQuery().data;

  async function onSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  if (!me) return null;
  const name = me.name ?? "You";
  const email = me.email ?? "";
  const image = me.image ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-white/10 px-2 py-1 text-sm transition hover:bg-white/10">
        <UserAvatar image={image} name={name} size={24} />
        <span className="pr-1">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5 text-xs text-white/60">{email}</div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/profile">
            <UserRound className="h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
