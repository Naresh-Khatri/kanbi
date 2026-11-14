import { BlockList, isIPv4, isIPv6 } from "node:net";

// everything that isn't the public internet: loopback, private, link-local (cloud metadata), cgnat, multicast, reserved
const blocked = new BlockList();
// separate list: node matches v4 lookups against ::ffff: v6 rules
const blocked6 = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 127],
  // mapped/translated v4 not in dotted form; dotted mapped ones are checked as v4 below
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked6.addSubnet(net, prefix, "ipv6");
}

/** True only for addresses on the public internet. */
export function isPublicAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return !blocked.check(mapped, "ipv4");
  if (isIPv4(address)) return !blocked.check(address, "ipv4");
  if (isIPv6(address)) return !blocked6.check(address, "ipv6");
  return false;
}
