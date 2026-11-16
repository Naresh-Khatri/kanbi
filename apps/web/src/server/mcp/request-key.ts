import "server-only";

import { createHash } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";

import { db } from "@/server/db";
import { mcpRequest } from "@/server/db/schema";

import { McpUserError } from "./result";

const KEY_TTL_MS = 24 * 60 * 60 * 1000;
// past this a pending row means the first call died after writing
const PENDING_STALE_MS = 2 * 60 * 1000;

/**
 * Run fn once per (user, client, key). A retry with the same key and input
 * gets the first result back instead of running again. No key -> plain run.
 */
export async function runOnce<T extends Record<string, unknown>>(
  scope: { userId: string; clientId: string },
  key: string | undefined,
  input: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  if (!key) return fn();
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  const now = new Date();
  const where = and(
    eq(mcpRequest.userId, scope.userId),
    eq(mcpRequest.clientId, scope.clientId),
    eq(mcpRequest.key, key),
  );

  const claimed = await db
    .insert(mcpRequest)
    .values({
      userId: scope.userId,
      clientId: scope.clientId,
      key,
      fingerprint,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [mcpRequest.userId, mcpRequest.clientId, mcpRequest.key],
      set: { fingerprint, result: null, createdAt: now },
      // expired keys are free to reuse
      setWhere: lt(mcpRequest.createdAt, new Date(now.getTime() - KEY_TTL_MS)),
    })
    .returning({ key: mcpRequest.key });

  if (claimed.length === 0) {
    const [prev] = await db.select().from(mcpRequest).where(where).limit(1);
    if (!prev) {
      throw new McpUserError("Retry the call with the same requestKey.");
    }
    if (prev.fingerprint !== fingerprint) {
      throw new McpUserError(
        "This requestKey was already used for a different request. Use a new key for new work.",
      );
    }
    if (prev.result) return prev.result as T;
    throw new McpUserError(
      now.getTime() - prev.createdAt.getTime() > PENDING_STALE_MS
        ? "An earlier call with this requestKey may have succeeded but its result was lost. Check with search_tasks before retrying with a new key."
        : "The first call with this requestKey is still running. Wait a few seconds, then retry with the same key.",
    );
  }

  let result: T;
  try {
    result = await fn();
  } catch (err) {
    // nothing was created; free the key for a retry
    await db
      .delete(mcpRequest)
      .where(where)
      .catch(() => undefined);
    throw err;
  }
  await db
    .update(mcpRequest)
    .set({ result })
    .where(where)
    .catch((err: unknown) =>
      console.error("[mcp] request key result not saved", err),
    );
  return result;
}
