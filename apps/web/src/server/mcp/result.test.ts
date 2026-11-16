import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { toFailure } from "./result";

const text = (r: ReturnType<typeof toFailure>) =>
  (r.content[0] as { text: string }).text;

describe("toFailure", () => {
  it("passes router messages through so the agent can self-correct", () => {
    const err = new TRPCError({
      code: "BAD_REQUEST",
      message: "One or more labels do not belong to this board.",
    });
    expect(text(toFailure(err))).toBe(
      "One or more labels do not belong to this board.",
    );
  });

  it("explains bare codes instead of a generic failure", () => {
    expect(text(toFailure(new TRPCError({ code: "NOT_FOUND" })))).toBe(
      "Not found, or you do not have access to it.",
    );
  });

  it("hides internal errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const err = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "pg: boom",
    });
    expect(text(toFailure(err))).toBe("Kanbi could not complete this request.");
  });
});
