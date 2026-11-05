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
  return register(auth).tools;
}

function register(auth: McpAuthorization) {
  const tools: Registration[] = [];
  const prompts: string[] = [];
  const server = {
    registerTool(name: string, config: Registration["config"]) {
      tools.push({ name, config });
    },
    registerPrompt(name: string) {
      prompts.push(name);
    },
  } as unknown as McpServer;
  registerTools(server, auth);
  return { tools, prompts };
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
    ).toEqual([
      "list_projects",
      "get_project_context",
      "search_tasks",
      "get_work_queue",
      "get_task",
    ]);
  });

  it("registers only mutations for a write-only grant", () => {
    expect(
      collect(authorization(["kanbi:write"])).map((tool) => tool.name),
    ).toEqual(["create_tasks", "start_task", "finish_task"]);
  });

  it("registers capture and work tools plus the work prompt for a complete grant", () => {
    const { tools, prompts } = register(
      authorization(["kanbi:read", "kanbi:write"]),
    );
    expect(tools.map((tool) => tool.name)).toEqual([
      "list_projects",
      "get_project_context",
      "search_tasks",
      "create_tasks",
      "get_work_queue",
      "get_task",
      "start_task",
      "finish_task",
    ]);
    expect(prompts).toEqual(["work"]);
  });

  it("offers the work prompt only when both scopes are granted", () => {
    expect(register(authorization(["kanbi:read"])).prompts).toEqual([]);
    expect(register(authorization(["kanbi:write"])).prompts).toEqual([]);
  });

  it("advertises accurate annotations and structured output", () => {
    const tools = collect(authorization(["kanbi:read", "kanbi:write"]));
    const writes = ["create_tasks", "start_task", "finish_task"];
    const hints = (name: string) =>
      tools.find((tool) => tool.name === name)?.config.annotations;
    expect(hints("create_tasks")?.idempotentHint).toBe(false);
    expect(hints("start_task")?.idempotentHint).toBe(true);
    for (const tool of tools) {
      expect(tool.config.annotations?.readOnlyHint).toBe(
        !writes.includes(tool.name),
      );
      expect(tool.config.annotations?.destructiveHint).toBe(false);
    }
    expect(tools.every((tool) => tool.config.outputSchema)).toBe(true);
  });
});
