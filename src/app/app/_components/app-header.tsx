import Link from "next/link";

import { NotificationBell } from "@/app/app/_components/notification-bell";
import { UserMenu } from "@/app/app/_components/user-menu";
import { Logo } from "@/components/ui/logo";

export function AppHeader({
  start,
  end,
}: {
  start?: React.ReactNode;
  end?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-[57px] items-center justify-between gap-3 border-b border-white/10 bg-[#0b0b0f]/80 px-6 backdrop-blur">
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
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
