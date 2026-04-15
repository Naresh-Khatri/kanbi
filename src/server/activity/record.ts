import type { db as Db } from "@/server/db";
import { activity } from "@/server/db/schema";
import { bus } from "@/server/realtime/bus";

/**
 * Insert an activity row and fan the event out so subscribers refresh.
 * Fire-and-forget friendly — callers `await` to guarantee ordering when needed.
 */
export async function recordActivity(
  db: typeof Db,
  args: {
    boardId: string;
    taskId?: string | null;
    actorId: string;
    verb: string;
    payload?: Record<string, unknown>;
  },
) {
  await db.insert(activity).values({
    boardId: args.boardId,
    taskId: args.taskId ?? null,
    actorId: args.actorId,
    verb: args.verb,
    payload: args.payload ?? {},
  });
  bus.emitBoard(args.boardId, {
    scope: "activity",
    ids: args.taskId ? [args.taskId] : [],
  });
}
