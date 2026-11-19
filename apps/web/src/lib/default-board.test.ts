import { describe, expect, it } from "vitest";

import { DEFAULT_COLUMNS } from "./default-board";

describe("DEFAULT_COLUMNS", () => {
  it("seeds backlog, todo, in progress, in review, done in order", () => {
    expect(
      DEFAULT_COLUMNS.map(({ name, category, position }) => [
        name,
        category,
        position,
      ]),
    ).toEqual([
      ["Backlog", "backlog", 1],
      ["Todo", "unstarted", 2],
      ["In Progress", "started", 3],
      ["In Review", "review", 4],
      ["Done", "completed", 5],
    ]);
  });
});
