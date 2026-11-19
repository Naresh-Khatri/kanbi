import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as ColumnsModule from "@/server/mcp/columns";
import type * as ProjectContextModule from "@/server/mcp/project-context";
import type * as TaskRefModule from "@/server/mcp/task-ref";

vi.mock("server-only", () => ({}));

const caller = {
  task: { move: vi.fn() },
  project: { create: vi.fn() },
  column: {
    create: vi.fn(),
    rename: vi.fn(),
    setCategory: vi.fn(),
    reorder: vi.fn(),
  },
};
vi.mock("@/server/mcp/caller", () => ({
  createMcpCaller: vi.fn(async () => caller),
}));

// every direct query here is a single-row lookup (board id, last task position)
vi.mock("@/server/db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "orderBy", "limit"]) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (rows: unknown[]) => void) =>
    resolve([{ id: "board-1" }]);
  return { db: chain };
});

const access = vi.fn();
vi.mock("@/server/api/permissions", () => ({
  resolveProjectAccess: (...args: unknown[]) => access(...args),
}));

const columnsMock = vi.fn();
vi.mock("@/server/mcp/columns", async (importOriginal) => ({
  ...(await importOriginal<typeof ColumnsModule>()),
  boardColumns: (...args: unknown[]) => columnsMock(...args),
}));

const resolveTaskMock = vi.fn();
vi.mock("@/server/mcp/task-ref", async (importOriginal) => ({
  ...(await importOriginal<typeof TaskRefModule>()),
  resolveTask: (...args: unknown[]) => resolveTaskMock(...args),
}));

const contextMock = vi.fn();
vi.mock("@/server/mcp/project-context", async (importOriginal) => ({
  ...(await importOriginal<typeof ProjectContextModule>()),
  loadProjectContext: (...args: unknown[]) => contextMock(...args),
}));

// same contract as the db-backed runOnce: one run per key, replay its result
vi.mock("@/server/mcp/request-key", () => {
  const seen = new Map<string, unknown>();
  return {
    runOnce: async (
      _scope: unknown,
      key: string | undefined,
      _input: unknown,
      fn: () => Promise<unknown>,
    ) => {
      if (!key) return fn();
      if (!seen.has(key)) seen.set(key, await fn());
      return seen.get(key);
    },
  };
});

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { DEFAULT_COLUMNS } from "@/lib/default-board";
import { type BoardColumn, columnSlot, findColumn } from "@/server/mcp/columns";
import { registerTools } from "@/server/mcp/tools";

type Handler = (args: Record<string, unknown>) => Promise<CallToolResult>;

function tools() {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool(name: string, _config: unknown, handler: Handler) {
      handlers.set(name, handler);
    },
    registerPrompt() {},
  } as unknown as McpServer;
  registerTools(server, {
    userId: "user-1",
    clientId: "client-1",
    scopes: ["kanbi:read", "kanbi:write"],
  });
  return (name: string, args: Record<string, unknown>) =>
    handlers.get(name)!(args);
}

const call = tools();

const text = (r: CallToolResult) =>
  r.content.map((c) => (c.type === "text" ? c.text : "")).join("");

const board: BoardColumn[] = [
  { id: "c-backlog", name: "Backlog", category: "backlog", position: 1 },
  { id: "c-todo", name: "Todo", category: "unstarted", position: 2 },
  { id: "c-doing", name: "In Progress", category: "started", position: 3 },
  { id: "c-review", name: "In Review", category: "review", position: 4 },
  { id: "c-done", name: "Done", category: "completed", position: 5 },
];

const ownTask = {
  id: "task-1",
  number: 12,
  identifier: "UNO-12",
  assigneeId: "user-1",
  boardId: "board-1",
  columnId: "c-todo",
  columnName: "Todo",
  category: "unstarted",
  projectSlug: "uno",
};

beforeEach(() => {
  vi.clearAllMocks();
  columnsMock.mockResolvedValue(board);
  resolveTaskMock.mockResolvedValue(ownTask);
  access.mockResolvedValue({ role: "owner", canWrite: true, canAdmin: true });
});

describe("move_task", () => {
  it("moves the user's own task with a compare-and-swap on its column", async () => {
    const res = await call("move_task", {
      task: "UNO-12",
      column: "in review",
    });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({
      status: "moved",
      from: "Todo",
      column: "In Review",
    });
    expect(caller.task.move).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        toColumnId: "c-review",
        expectedColumnId: "c-todo",
      }),
    );
  });

  it("leaves someone else's task alone", async () => {
    resolveTaskMock.mockResolvedValue({ ...ownTask, assigneeId: "user-2" });
    const res = await call("move_task", {
      task: "UNO-12",
      column: "In Review",
    });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("assigned to someone else");
    expect(caller.task.move).not.toHaveBeenCalled();
  });

  it("refuses unassigned tasks", async () => {
    resolveTaskMock.mockResolvedValue({ ...ownTask, assigneeId: null });
    const res = await call("move_task", {
      task: "UNO-12",
      column: "In Review",
    });
    expect(text(res)).toContain("assign_to_me");
    expect(caller.task.move).not.toHaveBeenCalled();
  });

  it("reports a card moved by someone else instead of overwriting", async () => {
    caller.task.move.mockRejectedValue(
      new TRPCError({
        code: "CONFLICT",
        message: "Task moved since it was read.",
      }),
    );
    const res = await call("move_task", {
      task: "UNO-12",
      column: "In Review",
    });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("moved by someone else meanwhile");
  });

  it("refuses done and canceled columns and points to finish_task", async () => {
    columnsMock.mockResolvedValue([
      ...board,
      { id: "c-cancel", name: "Canceled", category: "canceled", position: 6 },
    ]);
    for (const column of ["done", "Canceled"]) {
      const res = await call("move_task", { task: "UNO-12", column });
      expect(res.isError).toBe(true);
      expect(text(res)).toContain("finish_task");
    }
    expect(caller.task.move).not.toHaveBeenCalled();
  });

  it("lists the columns for an unknown or ambiguous name", async () => {
    const unknown = await call("move_task", { task: "UNO-12", column: "QA" });
    expect(text(unknown)).toContain('No column "QA"');
    expect(text(unknown)).toContain('"In Review" (review, id c-review)');

    columnsMock.mockResolvedValue([
      ...board,
      {
        id: "c-review-2",
        name: "in review",
        category: "review",
        position: 4.5,
      },
    ]);
    const ambiguous = await call("move_task", {
      task: "UNO-12",
      column: "In Review",
    });
    expect(text(ambiguous)).toContain("matches more than one column");
    expect(text(ambiguous)).toContain("c-review-2");
    expect(caller.task.move).not.toHaveBeenCalled();
  });

  it("succeeds without a write when the task is already there", async () => {
    const res = await call("move_task", { task: "UNO-12", column: "TODO" });
    expect(res.structuredContent).toMatchObject({ status: "unchanged" });
    expect(caller.task.move).not.toHaveBeenCalled();
  });
});

describe("create_project", () => {
  const context = {
    project: {
      id: "p-1",
      key: "MS",
      slug: "marketing-site",
      name: "Marketing Site",
      description: null,
      authoringGuidance: null,
    },
    boardId: "board-1",
    columns: DEFAULT_COLUMNS.map((c, i) => ({
      id: `c-${i}`,
      name: c.name,
      category: c.category,
    })),
    labels: [],
    members: [{ id: "user-1", name: "Me" }],
    priorities: ["none", "low", "medium", "high", "urgent"],
    todayUtc: "2026-11-19",
  };

  beforeEach(() => {
    caller.project.create.mockResolvedValue({
      id: "p-1",
      slug: "marketing-site",
    });
    contextMock.mockResolvedValue(context);
  });

  it("creates the project with the default columns and returns its context", async () => {
    const res = await call("create_project", {
      name: "Marketing Site",
      requestKey: "req-project-1",
    });
    expect(res.isError).toBeFalsy();
    // derived key is sent explicitly so a clash fails instead of becoming MS2
    expect(caller.project.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Marketing Site", key: "MS" }),
    );
    const out = res.structuredContent as typeof context & { url: string };
    expect(out.columns.map((c) => [c.name, c.category])).toEqual([
      ["Backlog", "backlog"],
      ["Todo", "unstarted"],
      ["In Progress", "started"],
      ["In Review", "review"],
      ["Done", "completed"],
    ]);
    expect(out.url).toMatch(/\/app\/p\/marketing-site$/);
  });

  it("replays the original result for a retried requestKey", async () => {
    const args = { name: "Web", key: "web", requestKey: "req-project-2" };
    const first = await call("create_project", args);
    const retry = await call("create_project", args);
    expect(caller.project.create).toHaveBeenCalledTimes(1);
    expect(caller.project.create).toHaveBeenCalledWith(
      expect.objectContaining({ key: "WEB" }),
    );
    expect(retry.structuredContent).toEqual(first.structuredContent);
  });

  it("passes a key conflict through with the suggested alternative", async () => {
    caller.project.create.mockRejectedValue(
      new TRPCError({
        code: "CONFLICT",
        message:
          "Key WEB is already used by another of your projects. Try WEB2, or pick another key.",
      }),
    );
    const res = await call("create_project", {
      name: "Web",
      key: "WEB",
      requestKey: "req-project-3",
    });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("Try WEB2");
  });
});

describe("add_column / update_column", () => {
  const editor = { role: "editor", canWrite: true, canAdmin: false };

  it("refuses non-owners", async () => {
    access.mockResolvedValue(editor);
    const added = await call("add_column", {
      projectId: "p-1",
      name: "QA",
      category: "review",
      requestKey: "req-column-1",
    });
    const updated = await call("update_column", {
      projectId: "p-1",
      column: "Todo",
      name: "Ready",
    });
    for (const res of [added, updated]) {
      expect(res.isError).toBe(true);
      expect(text(res)).toContain("Only the project owner");
    }
    expect(caller.column.create).not.toHaveBeenCalled();
    expect(caller.column.rename).not.toHaveBeenCalled();
  });

  it("adds a column at the end of its category group", async () => {
    caller.column.create.mockResolvedValue({
      id: "c-qa",
      name: "QA",
      category: "review",
      position: 4.5,
    });
    const res = await call("add_column", {
      projectId: "p-1",
      name: "QA",
      category: "review",
      requestKey: "req-column-2",
    });
    expect(res.isError).toBeFalsy();
    expect(caller.column.create).toHaveBeenCalledWith({
      boardId: "board-1",
      name: "QA",
      category: "review",
      before: 4,
      after: 5,
    });
  });

  it("protects the board's last completed column", async () => {
    const res = await call("update_column", {
      projectId: "p-1",
      column: "Done",
      category: "review",
    });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("only done column");
    expect(caller.column.setCategory).not.toHaveBeenCalled();
  });

  it("allows retyping a completed column when another one remains", async () => {
    columnsMock.mockResolvedValue([
      ...board,
      { id: "c-shipped", name: "Shipped", category: "completed", position: 6 },
    ]);
    const res = await call("update_column", {
      projectId: "p-1",
      column: "Done",
      category: "review",
    });
    expect(res.isError).toBeFalsy();
    expect(caller.column.setCategory).toHaveBeenCalledWith({
      boardId: "board-1",
      columnId: "c-done",
      category: "review",
    });
  });

  it("renames and reorders without touching anything else", async () => {
    const res = await call("update_column", {
      projectId: "p-1",
      column: "in review",
      name: "QA",
      position: { before: "In Progress" },
    });
    expect(res.isError).toBeFalsy();
    expect(caller.column.rename).toHaveBeenCalledWith({
      boardId: "board-1",
      columnId: "c-review",
      name: "QA",
    });
    expect(caller.column.reorder).toHaveBeenCalledWith({
      boardId: "board-1",
      columnId: "c-review",
      before: 2,
      after: 3,
    });
    expect(caller.column.setCategory).not.toHaveBeenCalled();
  });

  it("refuses a name another column already has", async () => {
    const res = await call("update_column", {
      projectId: "p-1",
      column: "Todo",
      name: "backlog",
    });
    expect(text(res)).toContain('already has a column named "Backlog"');
    expect(caller.column.rename).not.toHaveBeenCalled();
  });
});

describe("columnSlot", () => {
  it("falls back to after the last earlier category", () => {
    const noReview = board.filter((c) => c.category !== "review");
    expect(columnSlot(noReview, { category: "review" })).toEqual({
      before: 3,
      after: 5,
    });
    expect(columnSlot(board, { category: "backlog" })).toEqual({
      before: 1,
      after: 2,
    });
    expect(columnSlot([], { category: "started" })).toEqual({
      before: null,
      after: null,
    });
  });

  it("places before or after an anchor and never next to itself", () => {
    expect(
      columnSlot(board, { category: "review", position: { after: "Done" } }),
    ).toEqual({ before: 5, after: null });
    expect(
      columnSlot(board, {
        category: "backlog",
        position: { before: "backlog" },
      }),
    ).toEqual({ before: null, after: 1 });
    expect(() =>
      columnSlot(board, {
        category: "review",
        position: { before: "In Review" },
        movingId: "c-review",
      }),
    ).toThrow("not itself");
  });

  it("refuses a gap too small to split instead of renumbering", () => {
    const tight: BoardColumn[] = [
      { id: "a", name: "A", category: "started", position: 1 },
      { id: "b", name: "B", category: "review", position: 1.0001 },
    ];
    expect(() =>
      columnSlot(tight, { category: "started", position: { after: "A" } }),
    ).toThrow("no room");
  });

  it("matches ids exactly before names", () => {
    expect(findColumn(board, "c-done").name).toBe("Done");
  });
});
