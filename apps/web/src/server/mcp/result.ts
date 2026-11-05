import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

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

export function toFailure(err: unknown): CallToolResult {
  if (err instanceof McpUserError) return fail(err.message);
  console.error("[mcp] tool failed", err);
  return fail("Kanbi could not complete this request.");
}
