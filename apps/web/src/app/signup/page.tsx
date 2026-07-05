import { socialProvidersEnabled } from "@/server/better-auth/config";

import { SignupForm } from "./_components/signup-form";

// per-request -> read providers from RUNTIME env. build has no OAuth secrets
// (SKIP_ENV_VALIDATION), so a static prerender bakes in "no providers" forever
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return <SignupForm providers={socialProvidersEnabled} />;
}
