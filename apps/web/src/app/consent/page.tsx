import { Suspense } from "react";

import { ConsentForm } from "./consent-form";

// Rendered by the OAuth provider mid-flow (oauthProvider.consentPage). The user
// is already authenticated by this point (the plugin handles login first).
export default function ConsentPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0a0a0a] px-4">
      <Suspense>
        <ConsentForm />
      </Suspense>
    </main>
  );
}
