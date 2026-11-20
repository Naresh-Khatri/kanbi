import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SessionWatcher } from "@/app/app/_components/session-watcher";
import { KeybindProvider } from "@/components/keybinds/keybind-provider";
import { loginUrl, RETURN_URL_HEADER } from "@/lib/return-url";
import { getSession } from "@/server/better-auth/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session?.user) {
    const h = await headers();
    // cookie but no session = it expired/was revoked, not a first visit
    redirect(
      loginUrl(h.get(RETURN_URL_HEADER), { expired: !!getSessionCookie(h) }),
    );
  }

  return (
    // fixed height so board/docs can fill with flex-1 min-h-0
    <div className="flex h-svh min-w-0 flex-col">
      {children}
      <KeybindProvider />
      <SessionWatcher />
    </div>
  );
}
