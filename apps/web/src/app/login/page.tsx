import { Suspense } from "react";

import { socialProvidersEnabled } from "@/server/better-auth/config";
import { db } from "@/server/db";
import { resolveAuthInvite } from "@/server/invites";

import { LoginForm } from "./_components/login-form";

// per-request -> read providers from RUNTIME env. build has no OAuth secrets
// (SKIP_ENV_VALIDATION), so a static prerender bakes in "no providers" forever
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { invite: token } = await searchParams;
  const invite = await resolveAuthInvite(
    db,
    typeof token === "string" ? token : undefined,
  );
  return (
    <Suspense>
      <LoginForm invite={invite} providers={socialProvidersEnabled} />
    </Suspense>
  );
}
