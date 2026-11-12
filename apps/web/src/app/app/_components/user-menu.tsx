"use client";

import {
  ArchiveIcon,
  BotIcon,
  KeyboardIcon,
  LogOutIcon,
  SparklesIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { APP_VERSION } from "@/changelog";
import { useAppShell } from "@/components/keybinds/shell-store";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@/components/ui/menu";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/server/better-auth/client";
import { api } from "@/trpc/react";

export function UserMenu() {
  const router = useRouter();
  const me = api.user.me.useQuery().data;
  const setCheatsheetOpen = useAppShell((s) => s.setCheatsheetOpen);

  async function onSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  if (!me) return null;
  const name = me.name ?? "You";
  const email = me.email ?? "";

  return (
    <Menu>
      <MenuTrigger
        aria-label="Account"
        className="rounded-full"
        render={<Button size="icon-sm" variant="ghost" />}
      >
        <UserAvatar image={me.image ?? null} name={name} size={24} />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-56">
        <MenuGroup>
          <MenuGroupLabel className="flex flex-col gap-0.5">
            <span className="text-foreground truncate font-medium">{name}</span>
            <span className="truncate font-normal">{email}</span>
          </MenuGroupLabel>
        </MenuGroup>
        <MenuLinkItem render={<Link href="/app/profile" />}>
          <UserRoundIcon aria-hidden="true" /> Profile
        </MenuLinkItem>
        <MenuLinkItem render={<Link href="/app/archive" />}>
          <ArchiveIcon aria-hidden="true" /> Archived projects
        </MenuLinkItem>
        <MenuLinkItem render={<Link href="/app/changelog" />}>
          <SparklesIcon aria-hidden="true" /> What&apos;s new
          <MenuShortcut className="font-mono tracking-normal">
            v{APP_VERSION}
          </MenuShortcut>
        </MenuLinkItem>
        <MenuLinkItem render={<Link href="/docs/mcp" />}>
          <BotIcon aria-hidden="true" /> Connect an agent
        </MenuLinkItem>
        <MenuItem onClick={() => setCheatsheetOpen(true)}>
          <KeyboardIcon aria-hidden="true" /> Keyboard shortcuts
          <MenuShortcut>?</MenuShortcut>
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={onSignOut}>
          <LogOutIcon aria-hidden="true" /> Sign out
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
