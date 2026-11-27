"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { api } from "@/trpc/react";

export function SettingsShell({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const project = api.project.bySlug.useQuery({ slug }).data;
  const base = `/app/p/${slug}/settings`;

  const tabs = [
    { value: base, label: "General" },
    { value: `${base}/access`, label: "Access" },
    { value: `${base}/milestones`, label: "Milestones" },
    { value: `${base}/notifications`, label: "Notifications" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          {project ? `${project.name} · ` : null}
          project details, access, milestones, and what Kanbi emails you.
        </p>
      </header>
      {/* route links; pathname drives selection */}
      <Tabs value={tabs.some((t) => t.value === pathname) ? pathname : null}>
        <TabsList aria-label="Settings sections" variant="underline">
          {tabs.map((t) => (
            <TabsTab
              key={t.value}
              nativeButton={false}
              render={<Link href={t.value} />}
              value={t.value}
            >
              {t.label}
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
