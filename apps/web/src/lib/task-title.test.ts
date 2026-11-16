import { describe, expect, it } from "vitest";

import { stripReplyPrefix } from "@/lib/task-title";

describe("stripReplyPrefix", () => {
  it("drops stacked reply/forward prefixes", () => {
    expect(stripReplyPrefix("RE: Some presentation issue 1")).toBe(
      "Some presentation issue 1",
    );
    expect(stripReplyPrefix("Fwd: re: FW[2]: Totals off")).toBe("Totals off");
  });

  it("leaves normal titles alone", () => {
    expect(stripReplyPrefix("Refactor auth")).toBe("Refactor auth");
    expect(stripReplyPrefix("Rework: header")).toBe("Rework: header");
  });

  it("keeps the original when nothing would remain", () => {
    expect(stripReplyPrefix("RE:")).toBe("RE:");
  });
});
