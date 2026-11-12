"use client";

import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

const TITLES: Record<string, string> = {
  "/app/archive": "Archived projects",
  "/app/changelog": "What's new",
  "/app/profile": "Profile",
};

export function DashboardBreadcrumb() {
  const pathname = usePathname();
  // home: logo alone is the title
  if (pathname === "/app") return null;
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>{TITLES[pathname] ?? "Kanbi"}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
