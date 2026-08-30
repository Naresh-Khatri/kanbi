import { describe, expect, it } from "vitest";

import { missingReferenceIds } from "@/server/tasks/validation";

describe("missingReferenceIds", () => {
  it("accepts matching IDs in a different order", () => {
    expect(
      missingReferenceIds(
        ["label-1", "label-2"],
        [{ id: "label-2" }, { id: "label-1" }],
      ),
    ).toEqual([]);
  });

  it("deduplicates requested IDs while preserving their order", () => {
    expect(
      missingReferenceIds(["missing-1", "missing-1", "missing-2"], []),
    ).toEqual(["missing-1", "missing-2"]);
  });

  it("reports unknown labels and assignees instead of dropping them", () => {
    expect(
      missingReferenceIds(["label-1", "label-unknown"], [{ id: "label-1" }]),
    ).toEqual(["label-unknown"]);
    expect(
      missingReferenceIds(["member-1", "member-unknown"], [{ id: "member-1" }]),
    ).toEqual(["member-unknown"]);
  });

  it("accepts an empty request", () => {
    expect(missingReferenceIds([], [{ id: "label-1" }])).toEqual([]);
  });
});
