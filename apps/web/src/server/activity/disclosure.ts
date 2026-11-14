type Viewer = {
  userId: string | null;
  canAdmin: boolean;
  discloseAgents: boolean;
};

/** Teammates see agent attribution only when the owner opts in; the owner and whoever ran the agent always do. */
export const seesAgent = (viewer: Viewer, actorId: string) =>
  viewer.discloseAgents || viewer.canAdmin || viewer.userId === actorId;

export function discloseActivity<
  T extends { actorId: string; payload: Record<string, unknown> | null },
>(viewer: Viewer, row: T): T {
  if (
    !row.payload ||
    !("agent" in row.payload) ||
    seesAgent(viewer, row.actorId)
  )
    return row;
  const { agent: _, agentKind: __, ...payload } = row.payload;
  return { ...row, payload };
}

export function discloseComment<
  T extends { authorId: string; agent: string | null },
>(viewer: Viewer, row: T): T {
  return row.agent && !seesAgent(viewer, row.authorId)
    ? { ...row, agent: null }
    : row;
}
