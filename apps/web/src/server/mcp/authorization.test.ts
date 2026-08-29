import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { authorizeMcpClaims } from "@/server/mcp/authorization";

describe("authorizeMcpClaims", () => {
  it("accepts string and array scope claim forms", () => {
    expect(
      authorizeMcpClaims(
        { sub: "user-1", azp: "client-1", scope: "openid kanbi:read" },
        ["kanbi:read"],
      ),
    ).toEqual({
      userId: "user-1",
      clientId: "client-1",
      scopes: ["kanbi:read"],
    });

    expect(
      authorizeMcpClaims(
        { sub: "user-1", azp: "client-1", scopes: ["kanbi:read"] },
        ["kanbi:read"],
      ),
    ).toEqual({
      userId: "user-1",
      clientId: "client-1",
      scopes: ["kanbi:read"],
    });
  });

  it("rejects claims without an identity or consent", () => {
    expect(authorizeMcpClaims({ azp: "client-1" }, ["kanbi:read"])).toBeNull();
    expect(authorizeMcpClaims({ sub: "user-1" }, ["kanbi:read"])).toBeNull();
    expect(
      authorizeMcpClaims(
        { sub: "user-1", azp: "client-1", scope: "kanbi:read" },
        null,
      ),
    ).toBeNull();
  });

  it("rejects Kanbi permissions that consent no longer grants", () => {
    expect(
      authorizeMcpClaims(
        { sub: "user-1", azp: "client-1", scope: "kanbi:read kanbi:write" },
        ["kanbi:read"],
      ),
    ).toBeNull();
  });

  it("returns only normalized Kanbi permissions", () => {
    expect(
      authorizeMcpClaims(
        {
          sub: "user-1",
          azp: "client-1",
          scope: "openid profile offline_access kanbi:read",
        },
        ["kanbi:read"],
      ),
    ).toEqual({
      userId: "user-1",
      clientId: "client-1",
      scopes: ["kanbi:read"],
    });
  });
});
