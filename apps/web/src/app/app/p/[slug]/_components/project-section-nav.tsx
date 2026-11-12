"use client";

import { FileTextIcon, SettingsIcon, SquareKanbanIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";

export function ProjectSectionNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/app/p/${slug}`;
  const value = pathname.startsWith(`${base}/docs`)
    ? "docs"
    : pathname.startsWith(`${base}/settings`)
      ? "settings"
      : pathname === base
        ? "board"
        : null;

  const tabs = [
    { value: "board", href: base, label: "Board", icon: SquareKanbanIcon },
    { value: "docs", href: `${base}/docs`, label: "Docs", icon: FileTextIcon },
    {
      value: "settings",
      href: `${base}/settings`,
      label: "Settings",
      icon: SettingsIcon,
    },
  ];

  return (
    // tabs as route links; value mirrors pathname, navigation drives selection
    <Tabs className="shrink-0" value={value}>
      <TabsList aria-label="Project sections" size="sm">
        {tabs.map(({ value: v, href, label, icon: Icon }) => (
          <TabsTab
            aria-label={label}
            key={v}
            nativeButton={false}
            render={<Link href={href} />}
            value={v}
          >
            <Icon aria-hidden="true" />
            <span className="max-sm:hidden">{label}</span>
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  );
}
