export const taskBoardHref = (slug: string, number: number) =>
  `/app/p/${slug}?task=${number}`;

export const taskPageHref = (slug: string, number: number) =>
  `/app/p/${slug}/t/${number}`;

// ?task= accepts "12", "KEY-12" (survives key renames) or a legacy task id
export function matchTaskParam<T extends { id: string; number: number }>(
  param: string,
  tasks: readonly T[],
): T | undefined {
  const byId = tasks.find((t) => t.id === param);
  if (byId) return byId;
  const m = /^(?:[A-Za-z0-9]+-)?(\d+)$/.exec(param.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  return tasks.find((t) => t.number === n);
}
