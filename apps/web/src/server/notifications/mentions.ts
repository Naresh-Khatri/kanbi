import { eq } from "drizzle-orm";

import type { db as Database } from "@/server/db";
import { board, projectMember, user as userTable } from "@/server/db/schema";

const MENTION_PATTERN = /(?:^|\s)@([a-zA-Z0-9._-]{2,64})/g;

export function extractMentionHandles(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const handle = match[1]?.toLowerCase();
    if (handle) out.add(handle);
  }
  return [...out];
}

/**
 * Match @handles in board-scoped text to project member user ids.
 * Matches against email local-part or name (lowercased, spaces stripped).
 */
export async function resolveMentions(
  db: typeof Database,
  boardId: string,
  text: string,
): Promise<string[]> {
  const handles = extractMentionHandles(text);
  if (handles.length === 0) return [];

  const boardRow = await db
    .select({ projectId: board.projectId })
    .from(board)
    .where(eq(board.id, boardId))
    .limit(1);
  const projectId = boardRow[0]?.projectId;
  if (!projectId) return [];

  const members = await db
    .select({
      userId: projectMember.userId,
      email: userTable.email,
      name: userTable.name,
    })
    .from(projectMember)
    .innerJoin(userTable, eq(userTable.id, projectMember.userId))
    .where(eq(projectMember.projectId, projectId));

  const handleSet = new Set(handles);
  const matched = new Set<string>();
  for (const m of members) {
    const emailLocal = m.email.split("@")[0]?.toLowerCase() ?? "";
    const nameKey = m.name.toLowerCase().replace(/\s+/g, "");
    if (handleSet.has(emailLocal) || handleSet.has(nameKey)) {
      matched.add(m.userId);
    }
  }
  return [...matched];
}
