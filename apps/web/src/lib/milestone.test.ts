import { describe, expect, it } from "vitest";

import {
  milestoneProgress,
  NO_MILESTONE,
  targetTone,
  taskMatchesMilestone,
} from "./milestone";

const categories = new Map([
  ["todo", "unstarted" as const],
  ["done", "completed" as const],
  ["nope", "canceled" as const],
]);

describe("milestoneProgress", () => {
  it("counts done over total, skipping canceled, archived and other milestones", () => {
    const tasks = [
      { milestoneId: "m1", columnId: "todo", archivedAt: null },
      { milestoneId: "m1", columnId: "done", archivedAt: null },
      { milestoneId: "m1", columnId: "done", archivedAt: new Date() },
      { milestoneId: "m1", columnId: "nope", archivedAt: null },
      { milestoneId: "m2", columnId: "done", archivedAt: null },
      { milestoneId: null, columnId: "todo", archivedAt: null },
    ];
    expect(milestoneProgress(tasks, categories, "m1")).toEqual({
      done: 1,
      total: 2,
    });
  });
});

describe("taskMatchesMilestone", () => {
  it("handles all, none and a specific milestone", () => {
    const inM1 = { milestoneId: "m1" };
    const loose = { milestoneId: null };
    expect(taskMatchesMilestone(inM1, null)).toBe(true);
    expect(taskMatchesMilestone(loose, NO_MILESTONE)).toBe(true);
    expect(taskMatchesMilestone(inM1, NO_MILESTONE)).toBe(false);
    expect(taskMatchesMilestone(inM1, "m1")).toBe(true);
    expect(taskMatchesMilestone(loose, "m1")).toBe(false);
  });
});

describe("targetTone", () => {
  const now = new Date(2026, 10, 27, 15);
  it("buckets like due dates", () => {
    expect(targetTone(null, now)).toBeNull();
    expect(targetTone(new Date(2026, 10, 26), now)).toBe("overdue");
    expect(targetTone(new Date(2026, 10, 27), now)).toBe("soon");
    expect(targetTone(new Date(2026, 10, 30), now)).toBe("soon");
    expect(targetTone(new Date(2026, 11, 1), now)).toBe("normal");
  });
});
