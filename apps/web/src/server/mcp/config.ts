import { env } from "@/env";

/**
 * Shared configuration for the MCP server and its OAuth provider.
 *
 * The MCP surface is exposed at `/api/mcp` and protected by the Better Auth
 * OAuth 2.1 provider (`@better-auth/oauth-provider`). Agents (Claude Code,
 * opencode) obtain a JWT access token via the browser consent flow, and the
 * MCP route verifies it against the JWKS below.
 */

// Better Auth derives its baseURL from the request when BETTER_AUTH_URL is
// unset; for issuer/audience we need a concrete value, so fall back to the dev
// origin (port 3333, see AGENTS.md).
const baseUrl = env.BETTER_AUTH_URL ?? "http://localhost:3333";

/**
 * OAuth/OIDC issuer. Better Auth mounts its OAuth endpoints under `/api/auth`
 * and issues JWTs with `iss` set accordingly (verified against the live
 * `/.well-known/oauth-authorization-server` metadata, whose `issuer` field is
 * `<baseURL>/api/auth`). The MCP route and the protected-resource metadata both
 * key off this exact value.
 */
export const MCP_ISSUER = `${baseUrl}/api/auth`;

/**
 * The MCP resource-server URL. This doubles as the OAuth audience: clients
 * pass it as the `resource` parameter (RFC 8707) and we verify the token's
 * `aud` against it.
 */
export const MCP_RESOURCE_URL = env.MCP_RESOURCE_URL ?? `${baseUrl}/api/mcp`;

/**
 * Accepted token audiences. A JWT access token is only minted when the client's
 * requested `resource` matches one of these (otherwise the provider falls back
 * to an opaque token, which the JWKS-verifying MCP route can't accept). In dev
 * the same server answers on both `kanbi.localhost` and `localhost`, and a
 * client may be pointed at either, so we accept both spellings of the resource.
 */
function withLocalhostAlias(url: string): string[] {
  const out = [url];
  try {
    const u = new URL(url);
    if (u.hostname !== "localhost") {
      u.hostname = "localhost";
      out.push(u.toString().replace(/\/$/, ""));
    }
  } catch {
    /* non-URL value; keep as-is */
  }
  return out;
}

export const MCP_AUDIENCES = Array.from(
  new Set(withLocalhostAlias(MCP_RESOURCE_URL)),
);

/** JWKS endpoint exposed by Better Auth's JWT plugin (auto-enabled by oauthProvider). */
export const MCP_JWKS_URL = `${baseUrl}/api/auth/jwks`;

// ── Scopes ──────────────────────────────────────────────────────────────────
// `openid` standardizes the identity claim (clients request it by default);
// `offline_access` makes the server issue a refresh token so agents renew
// silently instead of re-opening the browser. The two `kanbi:*` scopes are the
// actual authorization, enforced per-tool in the MCP route.
export const SCOPE_READ = "kanbi:read";
export const SCOPE_WRITE = "kanbi:write";

export const MCP_SCOPES = [
  "openid",
  "offline_access",
  SCOPE_READ,
  SCOPE_WRITE,
] as const;
