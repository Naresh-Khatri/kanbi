import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/** public getting-started pages: marketing dialect, left-aligned reading column */
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate min-h-dvh">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-radial-[ellipse_at_50%_0%] from-foreground/6 to-transparent to-70%"
      />
      <header className="mx-auto flex h-16 max-w-2xl items-center justify-between px-6">
        <Link aria-label="Kanbi home" className="rounded-md" href="/">
          <Wordmark size="sm" />
        </Link>
        <Button render={<Link href="/login" />} variant="ghost">
          Sign in
        </Button>
      </header>
      <main className="mx-auto max-w-2xl px-6 pt-10 pb-24 [&_p_code]:rounded-sm [&_p_code]:bg-muted [&_p_code]:px-1 [&_p_code]:py-0.5 [&_p_code]:font-mono [&_p_code]:text-[0.8125rem] [&_p_code]:text-foreground">
        {children}
      </main>
    </div>
  );
}
