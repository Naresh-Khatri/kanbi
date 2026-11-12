"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";

import { NotificationBell } from "@/app/app/_components/notification-bell";
import { UserMenu } from "@/app/app/_components/user-menu";
import { Logo } from "@/components/brand/logo";
import { useAppShell } from "@/components/keybinds/shell-store";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";

// h-header keeps h-below-header math valid for board/docs
export function AppHeader({
  start,
  end,
}: {
  start?: React.ReactNode;
  end?: React.ReactNode;
}) {
  const setPaletteOpen = useAppShell((s) => s.setPaletteOpen);

  return (
    <header className="h-header bg-background sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b px-3">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Home"
              render={<Link href="/app" />}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <Logo className="size-4.5" />
        </TooltipTrigger>
        <TooltipPopup>
          Home <Kbd>G</Kbd> <Kbd>H</Kbd>
        </TooltipPopup>
      </Tooltip>
      {/* slash hides when start renders nothing (home) */}
      <div className="before:text-muted-foreground/50 flex min-w-0 flex-1 items-center gap-2 before:text-sm before:content-['/'] empty:before:hidden">
        {start}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {end}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Search"
                onClick={() => setPaletteOpen(true)}
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <SearchIcon aria-hidden="true" />
          </TooltipTrigger>
          <TooltipPopup>
            Search{" "}
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </TooltipPopup>
        </Tooltip>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
