import { redirect } from "next/navigation";
import { Suspense } from "react";

import { randomAvatar } from "@/lib/avatar";
import { RETURN_URL_PARAM, safeReturnUrl } from "@/lib/return-url";
import { socialProvidersEnabled } from "@/server/better-auth/config";
import { getSession } from "@/server/better-auth/server";
import { db } from "@/server/db";
import { resolveAuthInvite } from "@/server/invites";

import { SignupForm } from "./_components/signup-form";

// per-request -> read providers from RUNTIME env. build has no OAuth secrets
// (SKIP_ENV_VALIDATION), so a static prerender bakes in "no providers" forever
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = params.invite;
  // already signed in -> skip the form. invite + oauth (sig) flows handle that themselves
  if (!token && !params.sig && (await getSession())?.user) {
    const returnUrl = params[RETURN_URL_PARAM];
    redirect(safeReturnUrl(typeof returnUrl === "string" ? returnUrl : null));
  }
  const invite = await resolveAuthInvite(
    db,
    typeof token === "string" ? token : undefined,
  );
  return (
    <Suspense>
      <SignupForm
        initialAvatar={randomAvatar()}
        invite={invite}
        providers={socialProvidersEnabled}
      />
    </Suspense>
  );
}
