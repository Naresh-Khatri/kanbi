"use client";

import { FileText, SquareKanban } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { segmentVariants } from "@/components/ui/tabs";

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
      className={segmentVariants({ size: "sm", active })}
      href={href}
    >
      {children}
    </Link>
  );
}
