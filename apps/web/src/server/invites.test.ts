import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { inviteLinkStatus } = await import("./invites");

const now = new Date("2026-11-16T12:00:00Z");
const base = { revokedAt: null, expiresAt: null, maxUses: 3, usesCount: 0 };

describe("inviteLinkStatus", () => {
  it("is valid while under the cap and unexpired", () => {
    expect(
      inviteLinkStatus(
        { ...base, usesCount: 2, expiresAt: new Date("2026-11-17") },
        now,
      ),
    ).toBe("valid");
  });

  it("is full once uses reach the cap", () => {
    expect(inviteLinkStatus({ ...base, usesCount: 3 }, now)).toBe("full");
  });

  it("is expired at the exact expiry instant", () => {
    expect(inviteLinkStatus({ ...base, expiresAt: now }, now)).toBe("expired");
  });

  it("reports revoked before expired or full", () => {
    expect(
      inviteLinkStatus(
        { ...base, revokedAt: now, expiresAt: now, usesCount: 3 },
        now,
      ),
    ).toBe("revoked");
  });
});
