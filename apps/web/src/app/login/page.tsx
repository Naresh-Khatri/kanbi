import { socialProvidersEnabled } from "@/server/better-auth/config";

import { LoginForm } from "./_components/login-form";

// Server component: reads which social providers are configured (server env)
// and hands them to the client form so unconfigured providers render no button.
export default function LoginPage() {
  return <LoginForm providers={socialProvidersEnabled} />;
}
