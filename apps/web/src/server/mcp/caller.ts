import "server-only";

import { eq } from "drizzle-orm";

import { createCaller } from "@/server/api/root";
import { type createTRPCContext } from "@/server/api/trpc";
import { db } from "@/server/db";
import { user as userTable } from "@/server/db/schema";

type Ctx = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Build a tRPC caller that acts as `userId`.
 *
 * The MCP route has already verified the OAuth JWT; we synthesize a session
 * from its `sub` so every existing protected/project/board procedure - and the
 * authorization encoded in those procedure types - runs unchanged. Mutations
 * still emit on the realtime bus, so agent-driven changes show up live in the
 * web UI. This owes nothing to the device-token path; it's just how a
 * server-side tRPC call gets an identity.
 */
export async function createMcpCaller(userId: string) {
  const [u] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!u) throw new Error(`MCP: no user for token subject "${userId}"`);

  const now = new Date();
  const session = {
    session: {
      id: `mcp:${userId}`,
      token: "mcp",
      userId,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
    user: { ...u, emailVerified: true, createdAt: now, updatedAt: now },
  } as Ctx["session"];

  const ctx: Ctx = { db, session, device: null, headers: new Headers() };
  return createCaller(ctx);
}
