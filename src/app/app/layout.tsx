import { redirect } from "next/navigation";

import { KeybindProvider } from "@/components/keybinds/keybind-provider";
import { getSession } from "@/server/better-auth/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">{children}</div>
      <KeybindProvider />
    </div>
  );
}
