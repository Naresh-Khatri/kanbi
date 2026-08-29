import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/mcp/caller", () => ({ createMcpCaller: vi.fn() }));

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { McpAuthorization } from "@/server/mcp/authorization";
import { registerTools } from "@/server/mcp/tools";

type Registration = {
  name: string;
  config: {
    annotations?: Record<string, boolean>;
    outputSchema?: unknown;
  };
};

function collect(auth: McpAuthorization): Registration[] {
  const registrations: Registration[] = [];
  const server = {
    registerTool(name: string, config: Registration["config"]) {
      registrations.push({ name, config });
    },
  } as unknown as McpServer;
  registerTools(server, auth);
  return registrations;
}

function authorization(scopes: string[]): McpAuthorization {
  return { userId: "user-1", clientId: "client-1", scopes };
}

describe("registerTools", () => {
  it("does not register tools without Kanbi permissions", () => {
    expect(collect(authorization([]))).toEqual([]);
  });

  it("registers only read tools for a read-only grant", () => {
    expect(
      collect(authorization(["kanbi:read"])).map((tool) => tool.name),
    ).toEqual(["list_projects", "get_project_context", "search_tasks"]);
  });

  it("registers only creation for a write-only grant", () => {
    expect(
      collect(authorization(["kanbi:write"])).map((tool) => tool.name),
    ).toEqual(["create_tasks"]);
  });

  it("registers all four task-capture tools for a complete grant", () => {
    expect(
      collect(authorization(["kanbi:read", "kanbi:write"])).map(
        (tool) => tool.name,
      ),
    ).toEqual([
      "list_projects",
      "get_project_context",
      "search_tasks",
      "create_tasks",
    ]);
  });

  it("advertises accurate annotations and structured output", () => {
    const tools = collect(authorization(["kanbi:read", "kanbi:write"]));
    const createTasks = tools.find((tool) => tool.name === "create_tasks");
    expect(createTasks?.config.annotations?.idempotentHint).toBe(false);
    for (const tool of tools.filter((tool) => tool.name !== "create_tasks")) {
      expect(tool.config.annotations?.readOnlyHint).toBe(true);
    }
    expect(tools.every((tool) => tool.config.outputSchema)).toBe(true);
  });
});
