import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";

import { MCP_ISSUER, MCP_RESOURCE_URL } from "@/server/mcp/config";

// RFC 9728 Protected Resource Metadata: tells MCP clients which authorization
// server protects `/api/mcp`. `authServerUrls` must match the `issuer` advertised
// by the auth server's metadata - verify against the live discovery doc.
export const GET = protectedResourceHandler({
  authServerUrls: [MCP_ISSUER],
  resourceUrl: MCP_RESOURCE_URL,
});

export const OPTIONS = metadataCorsOptionsRequestHandler();
