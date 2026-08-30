import Link from "next/link";

import { Logo } from "@/components/ui/logo";

type OAuthErrorPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    error_description?: string | string[];
  }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OAuthErrorPage({
  searchParams,
}: OAuthErrorPageProps) {
  const params = await searchParams;
  const error = first(params.error) ?? "authorization_error";
  const description =
    first(params.error_description) ??
    "Kanbi could not complete the authorization request.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0b0b0f] to-[#15162c] px-6 text-white">
      <div className="flex w-full max-w-sm flex-col gap-5 text-center">
        <Link className="mx-auto flex items-center gap-2.5" href="/">
          <Logo className="h-8 w-8" />
          <span className="text-xl font-extrabold tracking-tight">Kanbi</span>
        </Link>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Authorization failed</h1>
          <p className="text-sm text-white/70">{description}</p>
          <code className="text-xs text-white/40">{error}</code>
        </div>

        <div className="flex justify-center gap-3">
          <Link
            className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-white/90"
            href="/docs/mcp"
          >
            View setup guide
          </Link>
          <Link
            className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium transition hover:bg-white/10"
            href="/app"
          >
            Back to app
          </Link>
        </div>
      </div>
    </main>
  );
}
