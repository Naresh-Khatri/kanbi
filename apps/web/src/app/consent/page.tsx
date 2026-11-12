import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";

import { ConsentForm } from "./consent-form";

// Rendered by the OAuth provider mid-flow (oauthProvider.consentPage). The user
// is already authenticated by this point (the plugin handles login first).
export default function ConsentPage() {
  return (
    <AuthShell>
      <Suspense>
        <ConsentForm />
      </Suspense>
    </AuthShell>
  );
}
