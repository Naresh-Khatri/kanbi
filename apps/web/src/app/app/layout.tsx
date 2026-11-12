import { redirect } from "next/navigation";

import { KeybindProvider } from "@/components/keybinds/keybind-provider";
import { getSession } from "@/server/better-auth/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    // fixed height so board/docs can fill with flex-1 min-h-0
    <div className="flex h-svh min-w-0 flex-col">
      {children}
      <KeybindProvider />
    </div>
  );
}
