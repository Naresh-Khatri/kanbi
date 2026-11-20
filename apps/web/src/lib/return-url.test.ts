import { describe, expect, it } from "vitest";

import {
  loginUrl,
  safeReturnUrl,
  socialCallbackUrl,
  withReturnUrl,
} from "./return-url";

describe("safeReturnUrl", () => {
  it("keeps same-origin paths with query", () => {
    expect(safeReturnUrl("/app/p/kan?task=4")).toBe("/app/p/kan?task=4");
  });
  it("rejects external and protocol-relative urls", () => {
    expect(safeReturnUrl("https://evil.com")).toBe("/app");
    expect(safeReturnUrl("//evil.com")).toBe("/app");
    expect(safeReturnUrl("/\\evil.com")).toBe("/app");
    expect(safeReturnUrl("javascript:alert(1)")).toBe("/app");
  });
  it("falls back when missing", () => {
    expect(safeReturnUrl(null)).toBe("/app");
    expect(safeReturnUrl("")).toBe("/app");
  });
});

describe("loginUrl", () => {
  it("encodes the return path", () => {
    expect(loginUrl("/app/p/kan?task=4")).toBe(
      "/login?returnUrl=%2Fapp%2Fp%2Fkan%3Ftask%3D4",
    );
  });
  it("omits the default", () => {
    expect(loginUrl("/app")).toBe("/login");
    expect(loginUrl("//evil.com")).toBe("/login");
  });
});

describe("withReturnUrl", () => {
  it("flags an expired session", () => {
    expect(loginUrl("/app/p/kan", { expired: true })).toBe(
      "/login?returnUrl=%2Fapp%2Fp%2Fkan&expired=1",
    );
    expect(loginUrl(null, { expired: true })).toBe("/login?expired=1");
  });
  it("works for other auth pages", () => {
    expect(withReturnUrl("/forgot-password", "/app/p/kan")).toBe(
      "/forgot-password?returnUrl=%2Fapp%2Fp%2Fkan",
    );
  });
});

describe("socialCallbackUrl", () => {
  it("keeps urls better-auth accepts", () => {
    expect(socialCallbackUrl("/app/p/kan?task=4")).toBe("/app/p/kan?task=4");
    expect(socialCallbackUrl("/invite/abc_DEF-1")).toBe("/invite/abc_DEF-1");
  });
  it("falls back when better-auth would reject it", () => {
    expect(socialCallbackUrl("/app/p/kan?x=a,b")).toBe("/app");
    expect(socialCallbackUrl("/app/p/kan?x=a:b")).toBe("/app");
  });
});
