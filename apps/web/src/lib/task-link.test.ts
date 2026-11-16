import { describe, expect, it } from "vitest";

import { matchTaskParam } from "./task-link";

const tasks = [
  { id: "abcDEF123", number: 12 },
  { id: "x-7", number: 3 },
];

describe("matchTaskParam", () => {
  it("matches a bare number", () => {
    expect(matchTaskParam("12", tasks)?.id).toBe("abcDEF123");
  });
  it("matches KEY-N regardless of key", () => {
    expect(matchTaskParam("OLD-12", tasks)?.id).toBe("abcDEF123");
  });
  it("prefers an exact id over the number form", () => {
    expect(matchTaskParam("x-7", tasks)?.number).toBe(3);
  });
  it("matches a legacy id", () => {
    expect(matchTaskParam("abcDEF123", tasks)?.number).toBe(12);
  });
  it("returns undefined for unknown refs", () => {
    expect(matchTaskParam("99", tasks)).toBeUndefined();
    expect(matchTaskParam("nope", tasks)).toBeUndefined();
  });
});
