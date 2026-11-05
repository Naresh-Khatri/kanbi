import Link from "next/link";
import { Bot } from "lucide-react";

import { NotificationBell } from "@/app/app/_components/notification-bell";
import { UserMenu } from "@/app/app/_components/user-menu";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export function AppHeader({
  start,
  end,
  showAgentLink = false,
}: {
  start?: React.ReactNode;
  end?: React.ReactNode;
  showAgentLink?: boolean;
}) {
  return (
    <header className="bg-canvas/80 h-header sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/10 px-6 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          className="flex items-center gap-2 text-lg font-semibold"
          href="/app"
        >
          <Logo className="h-5 w-5" />
          Kanbi
        </Link>
        {start ? (
          <>
            <span aria-hidden className="h-4 w-px bg-white/15" />
            {start}
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {end}
        {showAgentLink ? (
          <Button
            asChild
            className="hidden gap-1.5 sm:inline-flex"
            size="sm"
            variant="outline"
          >
            <Link href="/docs/mcp">
              <Bot className="h-3.5 w-3.5" />
              Connect agent
            </Link>
          </Button>
        ) : null}
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
