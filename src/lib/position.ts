export const POSITION_STEP = 1024;
export const POSITION_EPSILON = 0.0005;

/** Position after all existing items. */
export function positionAtEnd(items: readonly { position: number }[]): number {
	if (items.length === 0) return POSITION_STEP;
	const last = items[items.length - 1]!;
	return last.position + POSITION_STEP;
}

/** Position before all existing items. */
export function positionAtStart(
	items: readonly { position: number }[],
): number {
	if (items.length === 0) return POSITION_STEP;
	return items[0]!.position / 2;
}

/**
 * Compute a position that sorts between `before` and `after`.
 * Either side may be null/undefined, meaning "edge of list".
 */
export function positionBetween(
	before: number | null | undefined,
	after: number | null | undefined,
): number {
	if (before == null && after == null) return POSITION_STEP;
	if (before == null) return after! / 2;
	if (after == null) return before + POSITION_STEP;
	return (before + after) / 2;
}

/** Detect when fractional gaps have collapsed and a rebalance is needed. */
export function needsRebalance(before: number, after: number): boolean {
	return after - before < POSITION_EPSILON;
}

/** Return evenly-spaced positions for `count` items, starting at `STEP`. */
export function rebalancePositions(count: number): number[] {
	return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
}
