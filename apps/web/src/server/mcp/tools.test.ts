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
      "find_tasks",
      "get_work_queue",
      "get_task",
      "get_task_comments",
      "get_task_images",
      "list_milestones",
      "get_milestone",
      "list_docs",
      "get_doc",
      "search_docs",
    ]);
  });

  it("registers only mutations for a write-only grant", () => {
    expect(
      collect(authorization(["kanbi:write"])).map((tool) => tool.name),
    ).toEqual([
      "create_tasks",
      "create_project",
      "add_column",
      "update_column",
      "start_task",
      "finish_task",
      "move_task",
      "assign_to_me",
      "comment_on_task",
      "report_blocker",
      "update_checklist",
      "set_task_labels",
      "add_attachment",
      "confirm_attachment",
      "edit_comment",
      "delete_comment",
      "update_task",
      "delete_task",
      "create_milestone",
      "update_milestone",
      "close_milestone",
      "set_task_milestone",
      "create_doc",
      "update_doc",
      "move_doc",
    ]);
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
      "create_project",
      "add_column",
      "update_column",
      "find_tasks",
      "get_work_queue",
      "get_task",
      "get_task_comments",
      "get_task_images",
      "start_task",
      "finish_task",
      "move_task",
      "assign_to_me",
      "comment_on_task",
      "report_blocker",
      "update_checklist",
      "set_task_labels",
      "add_attachment",
      "confirm_attachment",
      "edit_comment",
      "delete_comment",
      "update_task",
      "delete_task",
      "list_milestones",
      "get_milestone",
      "create_milestone",
      "update_milestone",
      "close_milestone",
      "set_task_milestone",
      "list_docs",
      "get_doc",
      "search_docs",
      "create_doc",
      "update_doc",
      "move_doc",
    ]);
    expect(prompts).toEqual(["work"]);
  });

  it("offers the work prompt only when both scopes are granted", () => {
    expect(register(authorization(["kanbi:read"])).prompts).toEqual([]);
    expect(register(authorization(["kanbi:write"])).prompts).toEqual([]);
  });

  it("advertises accurate annotations and structured output", () => {
    const tools = collect(authorization(["kanbi:read", "kanbi:write"]));
    const writes = [
      "create_tasks",
      "create_project",
      "add_column",
      "update_column",
      "start_task",
      "finish_task",
      "move_task",
      "assign_to_me",
      "comment_on_task",
      "report_blocker",
      "update_checklist",
      "set_task_labels",
      "add_attachment",
      "confirm_attachment",
      "edit_comment",
      "delete_comment",
      "update_task",
      "delete_task",
      "create_milestone",
      "update_milestone",
      "close_milestone",
      "set_task_milestone",
      "create_doc",
      "update_doc",
      "move_doc",
    ];
    const hints = (name: string) =>
      tools.find((tool) => tool.name === name)?.config.annotations;
    expect(hints("create_tasks")?.idempotentHint).toBe(false);
    expect(hints("start_task")?.idempotentHint).toBe(true);
    expect(hints("move_task")?.idempotentHint).toBe(true);
    expect(hints("update_column")?.idempotentHint).toBe(true);
    expect(hints("create_project")?.idempotentHint).toBe(false);
    expect(hints("add_column")?.idempotentHint).toBe(false);
    expect(hints("create_doc")?.idempotentHint).toBe(false);
    expect(hints("update_doc")?.idempotentHint).toBe(false);
    expect(hints("move_doc")?.idempotentHint).toBe(true);
    expect(hints("update_task")?.idempotentHint).toBe(false);
    expect(hints("create_milestone")?.idempotentHint).toBe(false);
    expect(hints("close_milestone")?.idempotentHint).toBe(false);
    expect(hints("set_task_milestone")?.idempotentHint).toBe(true);
    for (const tool of tools) {
      expect(tool.config.annotations?.readOnlyHint).toBe(
        !writes.includes(tool.name),
      );
      expect(tool.config.annotations?.destructiveHint).toBe(
        ["delete_comment", "delete_task", "close_milestone"].includes(
          tool.name,
        ),
      );
    }
    expect(tools.every((tool) => tool.config.outputSchema)).toBe(true);
  });
});
