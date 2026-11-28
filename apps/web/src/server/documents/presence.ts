// in-memory, single instance (same as the realtime bus); heartbeats every ~15s
const TTL_MS = 45_000;

export type Viewer = {
  id: string;
  name: string;
  image: string | null;
  editing: boolean;
};

type Entry = Viewer & { seen: number };

const store = ((globalThis as { __docPresence?: Map<string, Map<string, Entry>> })
  .__docPresence ??= new Map());

export function heartbeat(
  documentId: string,
  viewer: Viewer,
  leaving = false,
): Viewer[] {
  const now = Date.now();
  const viewers = store.get(documentId) ?? new Map<string, Entry>();
  if (leaving) viewers.delete(viewer.id);
  else viewers.set(viewer.id, { ...viewer, seen: now });
  for (const [id, entry] of viewers)
    if (now - entry.seen > TTL_MS) viewers.delete(id);
  if (viewers.size === 0) store.delete(documentId);
  else store.set(documentId, viewers);
  return [...viewers.values()]
    .filter((entry) => entry.id !== viewer.id)
    .map(({ seen: _seen, ...rest }) => rest);
}
