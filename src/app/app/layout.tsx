import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AppHeaderLeft,
  AppHeaderRight,
} from "@/app/app/_components/app-header-slot";
import { UserMenu } from "@/app/app/_components/user-menu";
import { KeybindProvider } from "@/components/keybinds/keybind-provider";
import { Logo } from "@/components/ui/logo";
import { getSession } from "@/server/better-auth/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-[57px] items-center justify-between gap-3 border-white/10 border-b bg-[#0b0b0f]/80 px-6 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            className="flex items-center gap-2 font-semibold text-lg"
            href="/app"
          >
            <Logo className="h-5 w-5" />
            Kanbi
          </Link>
          <AppHeaderLeft />
        </div>
        <div className="flex items-center gap-3">
          <AppHeaderRight />
          <UserMenu
            email={session.user.email ?? ""}
            image={session.user.image ?? null}
            name={session.user.name ?? "You"}
          />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <KeybindProvider />
    </div>
  );
}
