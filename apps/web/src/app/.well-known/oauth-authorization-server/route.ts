import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/server/better-auth";

// Root-level mirror of Better Auth's authorization-server metadata, for MCP
// clients that probe `/.well-known/oauth-authorization-server` directly instead
// of following the `WWW-Authenticate` header.
export const GET = oauthProviderAuthServerMetadata(auth);
