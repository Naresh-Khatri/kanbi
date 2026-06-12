import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/server/better-auth";

// Root-level OpenID configuration mirror for OIDC-aware clients.
export const GET = oauthProviderOpenIdConfigMetadata(auth);
