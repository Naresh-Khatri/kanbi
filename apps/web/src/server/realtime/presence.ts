import { bus } from "./bus";

/**
 * In-memory presence: a user is "online" on a board while they hold a live
 * `onBoardChange` subscription — no heartbeat, derived from the SSE lifecycle.
 * Single-instance only, same caveat as the bus (multi-instance needs Redis).
 */

// boardId -> (userId -> open connection count)
type Registry = Map<string, Map<string, number>>;

const globalForPresence = globalThis as unknown as {
  __kanbiPresence?: Registry;
};

const boards: Registry = globalForPresence.__kanbiPresence ?? new Map();
if (process.env.NODE_ENV !== "production") {
  globalForPresence.__kanbiPresence = boards;
}

/**
 * Mark a user present; returns `leave` to call when the subscription ends.
 * Emits only on the online/offline transition, not on every extra tab.
 */
export function joinPresence(boardId: string, userId: string): () => void {
  let users = boards.get(boardId);
  if (!users) {
    users = new Map();
    boards.set(boardId, users);
  }
  const prev = users.get(userId) ?? 0;
  users.set(userId, prev + 1);
  if (prev === 0) bus.emitBoard(boardId, { scope: "presence", ids: [] });

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const set = boards.get(boardId);
    if (!set) return;
    const next = (set.get(userId) ?? 0) - 1;
    if (next > 0) {
      set.set(userId, next);
      return;
    }
    set.delete(userId);
    if (set.size === 0) boards.delete(boardId);
    bus.emitBoard(boardId, { scope: "presence", ids: [] });
  };
}

/** Current list of online user ids for a board. */
export function listPresence(boardId: string): string[] {
  const users = boards.get(boardId);
  return users ? [...users.keys()] : [];
}
