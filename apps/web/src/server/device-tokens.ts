import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import type { db as DB } from "@/server/db";
import { deviceToken, user } from "@/server/db/schema";

const PREFIX = "kbf_";
const RAW_BYTES = 32;

export function mintDeviceToken(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = `${PREFIX}${randomBytes(RAW_BYTES).toString("base64url")}`;
  return {
    plaintext,
    hash: hashDeviceToken(plaintext),
    prefix: plaintext.slice(0, PREFIX.length + 6),
  };
}

export function hashDeviceToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export type DeviceSessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * Resolve `Authorization: Bearer <token>` to a user, bumping `lastSeenAt`.
 * Returns null on missing/invalid/revoked tokens — callers should treat that
 * as "no session" rather than throwing.
 */
export async function resolveBearerSession(args: {
  db: typeof DB;
  headers: Headers;
}): Promise<{
  user: DeviceSessionUser;
  device: { id: string; name: string };
} | null> {
  const header = args.headers.get("authorization") ?? args.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const plaintext = match[1]!.trim();
  if (!plaintext.startsWith(PREFIX)) return null;

  const tokenHash = hashDeviceToken(plaintext);

  const [row] = await args.db
    .select({
      deviceId: deviceToken.id,
      deviceName: deviceToken.name,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(deviceToken)
    .innerJoin(user, eq(user.id, deviceToken.userId))
    .where(
      and(eq(deviceToken.tokenHash, tokenHash), isNull(deviceToken.revokedAt)),
    )
    .limit(1);

  if (!row) return null;

  // Best-effort touch — never block the request on this.
  void args.db
    .update(deviceToken)
    .set({ lastSeenAt: new Date() })
    .where(eq(deviceToken.id, row.deviceId))
    .catch(() => {});

  return {
    device: { id: row.deviceId, name: row.deviceName },
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
      image: row.userImage,
    },
  };
}
