/** Return unique requested IDs that are not represented by the queried rows. */
export function missingReferenceIds(
  requestedIds: readonly string[],
  rows: readonly { id: string }[],
): string[] {
  const found = new Set(rows.map((row) => row.id));
  return Array.from(new Set(requestedIds)).filter((id) => !found.has(id));
}
