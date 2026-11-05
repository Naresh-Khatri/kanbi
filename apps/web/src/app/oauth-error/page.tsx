import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/logo";
import { PageTitle } from "@/components/ui/surface";

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
    <main className="bg-marketing flex min-h-screen items-center justify-center px-6 text-white">
      <div className="flex w-full max-w-sm flex-col gap-5 text-center">
        <Link className="mx-auto" href="/">
          <Wordmark />
        </Link>

        <div className="flex flex-col gap-2">
          <PageTitle>Authorization failed</PageTitle>
          <p className="text-sm text-white/70">{description}</p>
          <code className="text-xs text-white/40">{error}</code>
        </div>

        <div className="flex justify-center gap-3">
          <Button asChild shape="pill">
            <Link href="/docs/mcp">View setup guide</Link>
          </Button>
          <Button asChild shape="pill" variant="outline">
            <Link href="/app">Back to app</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
