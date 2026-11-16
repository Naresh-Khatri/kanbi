import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TRPCError } from "@trpc/server";

/** Error whose message is safe and useful to show the agent verbatim. */
export class McpUserError extends Error {}

export const ok = <T extends Record<string, unknown>>(
  data: T,
): CallToolResult => ({
  structuredContent: data,
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

export const fail = (message: string): CallToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

const CODE_MESSAGES: Partial<Record<TRPCError["code"], string>> = {
  NOT_FOUND: "Not found, or you do not have access to it.",
  FORBIDDEN: "You do not have permission to do this.",
  UNAUTHORIZED: "Not signed in; reconnect the Kanbi MCP server.",
  CONFLICT: "Someone changed this meanwhile; read it again and retry.",
  BAD_REQUEST: "Kanbi rejected the input.",
  TOO_MANY_REQUESTS: "Too many requests; wait a moment and retry.",
};

export function toFailure(err: unknown): CallToolResult {
  if (err instanceof McpUserError) return fail(err.message);
  // router messages are written for people; generic text leaves the agent unable to self-correct
  if (err instanceof TRPCError && err.code !== "INTERNAL_SERVER_ERROR") {
    const own = err.message && err.message !== err.code ? err.message : null;
    return fail(
      own ?? CODE_MESSAGES[err.code] ?? "Kanbi rejected this request.",
    );
  }
  console.error("[mcp] tool failed", err);
  return fail("Kanbi could not complete this request.");
}

/** `.catch(userFacing)`: router validation messages are written for people, so pass them through. */
export function userFacing(err: unknown): never {
  if (
    err instanceof TRPCError &&
    err.code !== "INTERNAL_SERVER_ERROR" &&
    !err.message.startsWith(err.code)
  ) {
    throw new McpUserError(err.message);
  }
  throw err;
}
