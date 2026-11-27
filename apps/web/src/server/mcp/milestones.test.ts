import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/server/mcp/caller", () => ({ createMcpCaller: vi.fn() }));
vi.mock("@/server/api/permissions", () => ({ resolveProjectAccess: vi.fn() }));

import { findMilestone } from "@/server/mcp/milestones";
import { McpUserError } from "@/server/mcp/result";

const ms = [
  { id: "m1", name: "v1.0", status: "closed" as const },
  { id: "m2", name: "v1.0", status: "active" as const },
  { id: "m3", name: "Launch", status: "upcoming" as const },
  { id: "m4", name: "beta", status: "active" as const },
  { id: "m5", name: "Beta", status: "upcoming" as const },
];

describe("findMilestone", () => {
  it("matches by exact id first", () => {
    expect(findMilestone(ms, "m1").id).toBe("m1");
  });

  it("matches names case-insensitively", () => {
    expect(findMilestone(ms, " launch ").id).toBe("m3");
  });

  it("prefers the open milestone when a closed one shares its name", () => {
    expect(findMilestone(ms, "V1.0").id).toBe("m2");
  });

  it("asks for the id when several open milestones share a name", () => {
    expect(() => findMilestone(ms, "beta")).toThrow(/more than one/);
  });

  it("lists the milestones when nothing matches", () => {
    expect(() => findMilestone(ms, "v9")).toThrow(McpUserError);
    expect(() => findMilestone(ms, "v9")).toThrow(/Launch/);
  });
});
