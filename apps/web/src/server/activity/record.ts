import type { db as Db } from "@/server/db";
import { activity } from "@/server/db/schema";
import { bus } from "@/server/realtime/bus";

export type ActivityCtx = {
  db: typeof Db;
  session: { user: { id: string } };
  agent?: { name: string } | null;
};

/**
 * Insert an activity row and fan the event out so subscribers refresh.
 * Actor comes from the session; agent calls are tagged with `payload.agent`.
 */
export async function recordActivity(
  ctx: ActivityCtx,
  args: {
    boardId: string;
    taskId?: string | null;
    verb: string;
    payload?: Record<string, unknown>;
  },
) {
  await ctx.db.insert(activity).values({
    boardId: args.boardId,
    taskId: args.taskId ?? null,
    actorId: ctx.session.user.id,
    verb: args.verb,
    payload: {
      ...args.payload,
      ...(ctx.agent ? { agent: ctx.agent.name } : {}),
    },
  });
  bus.emitBoard(args.boardId, {
    scope: "activity",
    ids: args.taskId ? [args.taskId] : [],
  });
}
