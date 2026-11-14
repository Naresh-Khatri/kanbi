import { describe, expect, it } from "vitest";

import { isPublicAddress } from "./address";

describe("isPublicAddress", () => {
  it("allows public addresses", () => {
    for (const ip of ["1.1.1.1", "142.250.72.14", "2606:4700:4700::1111"])
      expect(isPublicAddress(ip)).toBe(true);
  });

  it("blocks loopback, private, link-local and mapped forms", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "not-an-ip",
    ])
      expect(isPublicAddress(ip), ip).toBe(false);
  });
});
