import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

/**
 * Shell for the public getting-started pages. Marketing dialect (gradient
 * backdrop, no product chrome) but with a readable left-aligned column instead
 * of the centered hero composition.
 */
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-marketing min-h-screen text-white">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-6 py-6">
        <Link
          className="flex items-center gap-2 text-sm font-medium transition hover:opacity-80"
          href="/"
        >
          <Logo className="h-5 w-5" />
          Kanbi
        </Link>
        <Button asChild size="inline" variant="link">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-2xl px-6 pt-6 pb-24">{children}</main>
    </div>
  );
}
