import { describe, expect, it } from "vitest";

import { roleCan } from "@/server/api/permissions";

describe("roleCan", () => {
  it("allows every role to read", () => {
    expect(roleCan("viewer", "viewer")).toBe(true);
    expect(roleCan("editor", "viewer")).toBe(true);
    expect(roleCan("owner", "viewer")).toBe(true);
  });

  it("allows editors and owners to write", () => {
    expect(roleCan("viewer", "editor")).toBe(false);
    expect(roleCan("editor", "editor")).toBe(true);
    expect(roleCan("owner", "editor")).toBe(true);
  });

  it("reserves owner operations for owners", () => {
    expect(roleCan("viewer", "owner")).toBe(false);
    expect(roleCan("editor", "owner")).toBe(false);
    expect(roleCan("owner", "owner")).toBe(true);
  });
});
