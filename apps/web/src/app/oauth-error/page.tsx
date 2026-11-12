import { ShieldAlertIcon } from "lucide-react";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

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
    <AuthShell>
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlertIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Authorization failed</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
            {error}
          </code>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button render={<Link href="/docs/mcp" />} size="lg">
            View setup guide
          </Button>
          <Button render={<Link href="/app" />} size="lg" variant="outline">
            Back to app
          </Button>
        </EmptyContent>
      </Empty>
    </AuthShell>
  );
}
