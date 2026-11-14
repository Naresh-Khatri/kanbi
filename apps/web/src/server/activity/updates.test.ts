import { describe, expect, it } from "vitest";

import { summarizeUpdates } from "./updates";

const at = (min: number) => new Date(2026, 0, 1, 0, min);
const row = (
  taskId: string,
  verb: string,
  min: number,
  payload: Record<string, unknown> | null = null,
) => ({ taskId, verb, payload, createdAt: at(min) });

describe("summarizeUpdates", () => {
  it("collapses activity into one entry per task", () => {
    const out = summarizeUpdates([
      row("a", "task.updated", 1),
      row("a", "comment.created", 2),
      row("b", "task.updated", 3),
    ]);
    expect(out).toEqual([
      { taskId: "a", reason: "comment", count: 2, agent: null, at: at(2) },
      { taskId: "b", reason: "updated", count: 1, agent: null, at: at(3) },
    ]);
  });

  it("reports done by agent when the latest state change is a move to done", () => {
    const [u] = summarizeUpdates([
      row("a", "comment.created", 5, { agent: "Claude Code" }),
      row("a", "task.moved", 4, {
        toColumnCategory: "completed",
        agent: "Claude Code",
      }),
      row("a", "task.blocked", 1),
    ]);
    expect(u).toMatchObject({ reason: "done", agent: "Claude Code", count: 3 });
  });

  it("a later block beats an earlier finish", () => {
    const [u] = summarizeUpdates([
      row("a", "task.moved", 1, { toColumnCategory: "completed" }),
      row("a", "task.blocked", 2, { agent: "Codex" }),
    ]);
    expect(u).toMatchObject({ reason: "blocked", agent: "Codex" });
  });

  it("a move to a non-done column is a plain update", () => {
    const [u] = summarizeUpdates([
      row("a", "task.moved", 1, { toColumnCategory: "started" }),
    ]);
    expect(u?.reason).toBe("updated");
  });
});
