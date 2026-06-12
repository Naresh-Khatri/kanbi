import { socialProvidersEnabled } from "@/server/better-auth/config";

import { SignupForm } from "./_components/signup-form";

// Server component: reads which social providers are configured (server env)
// and hands them to the client form so unconfigured providers render no button.
export default function SignupPage() {
  return <SignupForm providers={socialProvidersEnabled} />;
}
