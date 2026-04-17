import { EventEmitter, on } from "node:events";

export type BoardEventScope =
  | "task"
  | "column"
  | "board"
  | "label"
  | "comment"
  | "checklist"
  | "attachment"
  | "activity"
  | "share"
  | "presence";

export type BoardEvent = {
  scope: BoardEventScope;
  /** Ids affected by the change; empty array = "list-level" invalidation. */
  ids: string[];
};

export type UserEvent = {
  scope: "notification";
  ids: string[];
};

type Bus = EventEmitter & {
  emitBoard: (boardId: string, event: BoardEvent) => void;
  emitUser: (userId: string, event: UserEvent) => void;
};

const globalForBus = globalThis as unknown as { __kanbiBus?: Bus };

function createBus(): Bus {
  const ee = new EventEmitter();
  // Plenty of headroom — every open board subscription adds a listener.
  ee.setMaxListeners(1000);
  const bus = ee as Bus;
  bus.emitBoard = (boardId, event) => {
    ee.emit(`board:${boardId}`, event);
  };
  bus.emitUser = (userId, event) => {
    ee.emit(`user:${userId}`, event);
  };
  return bus;
}

export const bus = globalForBus.__kanbiBus ?? createBus();
if (process.env.NODE_ENV !== "production") globalForBus.__kanbiBus = bus;

/** Subscribe to a board's event stream as an AsyncIterable. */
export async function* subscribeBoard(
  boardId: string,
  signal?: AbortSignal,
): AsyncGenerator<BoardEvent> {
  for await (const [evt] of on(bus, `board:${boardId}`, { signal })) {
    yield evt as BoardEvent;
  }
}

/** Subscribe to a user's personal event stream (notifications, etc). */
export async function* subscribeUser(
  userId: string,
  signal?: AbortSignal,
): AsyncGenerator<UserEvent> {
  for await (const [evt] of on(bus, `user:${userId}`, { signal })) {
    yield evt as UserEvent;
  }
}
