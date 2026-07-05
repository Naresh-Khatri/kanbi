import { socialProvidersEnabled } from "@/server/better-auth/config";

import { LoginForm } from "./_components/login-form";

// per-request -> read providers from RUNTIME env. build has no OAuth secrets
// (SKIP_ENV_VALIDATION), so a static prerender bakes in "no providers" forever
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm providers={socialProvidersEnabled} />;
}
