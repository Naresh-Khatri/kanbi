import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Exposes authClient.oauth2.* (consent, etc.) and auto-forwards the signed
  // `oauth_query` param through the login → consent redirect chain.
  plugins: [oauthProviderClient()],
});

export type Session = typeof authClient.$Infer.Session;
