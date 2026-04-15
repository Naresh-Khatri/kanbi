import { boardProcedure, createTRPCRouter } from "@/server/api/trpc";
import { subscribeBoard } from "@/server/realtime/bus";

export const realtimeRouter = createTRPCRouter({
  onBoardChange: boardProcedure.subscription(async function* ({
    input,
    signal,
  }) {
    for await (const evt of subscribeBoard(input.boardId, signal)) {
      yield evt;
    }
  }),
});
