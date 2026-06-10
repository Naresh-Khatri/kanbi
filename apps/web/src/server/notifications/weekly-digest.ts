import { and, eq, gte } from "drizzle-orm";

import type { db as Database } from "@/server/db";
import {
  activity,
  board,
  project,
  projectMember,
  user as userTable,
} from "@/server/db/schema";
import { DIGEST_WINDOW_MS, generateBoardDigest } from "@/server/digest/generate";
import { sendDigestEmail } from "@/server/mail";

/**
 * Weekly job: for every board that saw activity in the last 7 days, generate
 * and store an AI digest, then email it to members who opted in. Designed to be
 * called from the cron route on a weekly schedule.
 */
export async function runWeeklyDigests(db: typeof Database) {
  const since = new Date(Date.now() - DIGEST_WINDOW_MS);

  const activeBoards = await db
    .selectDistinct({ boardId: activity.boardId })
    .from(activity)
    .where(gte(activity.createdAt, since));

  let generated = 0;
  let emailed = 0;

  for (const { boardId } of activeBoards) {
    const result = await generateBoardDigest(db, boardId);
    if (!result) continue;
    generated += 1;

    const recipients = await db
      .select({
        email: userTable.email,
        slug: project.slug,
        name: project.name,
      })
      .from(projectMember)
      .innerJoin(project, eq(project.id, projectMember.projectId))
      .innerJoin(board, eq(board.projectId, project.id))
      .innerJoin(userTable, eq(userTable.id, projectMember.userId))
      .where(
        and(eq(board.id, boardId), eq(projectMember.digestEmail, true)),
      );

    for (const r of recipients) {
      if (!r.email) continue;
      try {
        await sendDigestEmail(r.email, {
          boardName: r.name,
          slug: r.slug,
          headline: result.content.headline,
          summary: result.content.summary,
          highlights: result.content.highlights,
        });
        emailed += 1;
      } catch {
        // Don't let one bad recipient abort the whole run.
      }
    }
  }

  return { boards: activeBoards.length, generated, emailed };
}
