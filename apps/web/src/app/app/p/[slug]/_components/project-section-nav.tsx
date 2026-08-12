"use client";

import { FileText, SquareKanban } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function ProjectSectionNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const docsActive = pathname.startsWith(`/app/p/${slug}/docs`);
  const boardActive = pathname === `/app/p/${slug}`;

  return (
    <nav aria-label="Project sections" className="flex items-center gap-0.5">
      <SectionLink active={boardActive} href={`/app/p/${slug}`}>
        <SquareKanban className="h-3.5 w-3.5" /> Board
      </SectionLink>
      <SectionLink active={docsActive} href={`/app/p/${slug}/docs`}>
        <FileText className="h-3.5 w-3.5" /> Docs
      </SectionLink>
    </nav>
  );
}

function SectionLink({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none",
        active
          ? "bg-white/10 text-white"
          : "text-white/50 hover:bg-white/5 hover:text-white/80",
      )}
      href={href}
    >
      {children}
    </Link>
  );
}
