import { describe, expect, it } from "vitest";

import {
  needsRebalance,
  POSITION_EPSILON,
  POSITION_STEP,
  positionAtEnd,
  positionAtStart,
  positionBetween,
  rebalancePositions,
} from "@/lib/position";

describe("fractional positions", () => {
  it("places items at list edges", () => {
    expect(positionAtStart([])).toBe(POSITION_STEP);
    expect(positionAtEnd([])).toBe(POSITION_STEP);
    expect(positionAtStart([{ position: 1024 }])).toBe(512);
    expect(positionAtEnd([{ position: 1024 }])).toBe(2048);
  });

  it("places items between either or both bounds", () => {
    expect(positionBetween(null, null)).toBe(POSITION_STEP);
    expect(positionBetween(null, 1000)).toBe(500);
    expect(positionBetween(1000, null)).toBe(1000 + POSITION_STEP);
    expect(positionBetween(1000, 2000)).toBe(1500);
  });

  it("detects a collapsed gap while its midpoint remains ordered", () => {
    const before = 1000;
    const after = before + POSITION_EPSILON / 2;
    expect(needsRebalance(before, after)).toBe(true);
    expect(positionBetween(before, after)).toBeGreaterThan(before);
    expect(positionBetween(before, after)).toBeLessThan(after);
  });

  it("rebalances to evenly spaced, increasing positions", () => {
    expect(rebalancePositions(0)).toEqual([]);
    expect(rebalancePositions(3)).toEqual([
      POSITION_STEP,
      POSITION_STEP * 2,
      POSITION_STEP * 3,
    ]);
  });
});
