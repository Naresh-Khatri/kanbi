import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";

import { auth } from "@/server/better-auth";

/**
 * RFC 8414 path-aware location for the authorization-server metadata. Our issuer
 * is `<host>/api/auth` (a non-root path), so a strict client inserts the
 * well-known segment after the host and appends the issuer path:
 * `<host>/.well-known/oauth-authorization-server/api/auth`. Better Auth warns
 * this must exist; opencode follows the issuer from the protected-resource
 * metadata and probes here. Claude Code uses the root mirror instead. Same doc
 * either way - the metadata's own `issuer` field is unaffected by where it's
 * served.
 */
export const GET = oauthProviderAuthServerMetadata(auth);
