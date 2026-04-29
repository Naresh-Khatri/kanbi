"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export function ProjectSettingsLink() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <Link
      aria-label="Project settings"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
      href={`/app/p/${slug}/settings`}
    >
      <Settings className="h-4 w-4" /> Settings
    </Link>
  );
}
