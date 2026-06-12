import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";

import { MCP_ISSUER, MCP_RESOURCE_URL } from "@/server/mcp/config";

/**
 * RFC 9728 locates Protected Resource Metadata at a path derived from the
 * resource: for a resource at `<host>/api/mcp` the document lives at
 * `<host>/.well-known/oauth-protected-resource/api/mcp` (the resource path is
 * appended after the well-known segment), not at the root.
 *
 * Claude Code is handed the resource URL directly via `claude mcp add`, so it
 * sends the `resource` indicator at the token endpoint without needing this
 * doc. opencode instead *discovers* the resource from this metadata - if it
 * 404s, opencode omits `resource` at /oauth2/token, the provider issues an
 * opaque (non-JWT) token, and the JWKS-verifying MCP route rejects it with 401
 * on every call. Serving the same metadata here lets opencode bind the resource
 * and receive a verifiable JWT. The root route is kept for lenient clients.
 */
export const GET = protectedResourceHandler({
  authServerUrls: [MCP_ISSUER],
  resourceUrl: MCP_RESOURCE_URL,
});

export const OPTIONS = metadataCorsOptionsRequestHandler();
