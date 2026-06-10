import { boardProcedure, createTRPCRouter } from "@/server/api/trpc";
import { subscribeBoard } from "@/server/realtime/bus";
import { joinPresence, listPresence } from "@/server/realtime/presence";

export const realtimeRouter = createTRPCRouter({
  onBoardChange: boardProcedure.subscription(async function* ({
    ctx,
    input,
    signal,
  }) {
    // The live subscription is the presence signal: join on connect, leave when
    // the SSE stream aborts (tab close / navigation).
    const leave = joinPresence(input.boardId, ctx.session.user.id);
    try {
      for await (const evt of subscribeBoard(input.boardId, signal)) {
        yield evt;
      }
    } finally {
      leave();
    }
  }),

  /** User ids currently viewing this board. */
  presence: boardProcedure.query(({ input }) => listPresence(input.boardId)),
});
