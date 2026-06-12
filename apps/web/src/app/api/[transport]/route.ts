import { mcpHandler } from "@better-auth/oauth-provider";
import { createMcpHandler } from "mcp-handler";

import { MCP_AUDIENCES, MCP_ISSUER, MCP_JWKS_URL } from "@/server/mcp/config";
import { registerTools } from "@/server/mcp/tools";

/**
 * MCP server over Streamable HTTP at `/api/mcp` (the `[transport]` segment
 * resolves to "mcp"). Static sibling routes - /api/auth, /api/trpc, /api/cron -
 * take precedence over this dynamic segment, so there's no collision.
 *
 * `mcpHandler` (Better Auth) verifies the OAuth JWT against the JWKS and
 * responds with the proper 401 + WWW-Authenticate when it's missing/invalid;
 * on success it hands the verified `jwt` to the tool layer. SSE is disabled so
 * we don't need Redis - clients use Streamable HTTP.
 */
const handler = mcpHandler(
  {
    jwksUrl: MCP_JWKS_URL,
    verifyOptions: { issuer: MCP_ISSUER, audience: MCP_AUDIENCES },
  },
  (req, jwt) =>
    createMcpHandler(
      (server) => registerTools(server, jwt),
      { serverInfo: { name: "Kanbi", version: "0.1.0" } },
      {
        basePath: "/api",
        maxDuration: 60,
        verboseLogs: false,
        disableSse: true,
      },
    )(req),
);

export { handler as GET, handler as POST, handler as DELETE };
