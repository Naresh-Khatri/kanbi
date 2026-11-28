import { describe, expect, it } from "vitest";

import { fileRefs, planSweep } from "./plan";

const now = new Date("2026-11-28T12:00:00Z");
const old = new Date("2026-11-26T12:00:00Z");
const fresh = new Date("2026-11-28T11:00:00Z");

describe("fileRefs", () => {
  it("collects ids from img, video and links", () => {
    const ids = fileRefs(
      '<img src="/api/files/a1"><video src="/api/files/v_2"></video><a href="/api/files/b-3">x</a>',
    );
    expect([...ids].sort()).toEqual(["a1", "b-3", "v_2"]);
  });

  it("ignores empty bodies", () => {
    expect(fileRefs(null).size).toBe(0);
  });
});

describe("planSweep", () => {
  it("drops old unreferenced doc images, keeps referenced or fresh ones", () => {
    const { unusedDocFiles } = planSweep({
      docFiles: [
        { id: "gone", key: "docs/p/gone.png", createdAt: old },
        { id: "used", key: "docs/p/used.png", createdAt: old },
        { id: "new", key: "docs/p/new.png", createdAt: fresh },
      ],
      referencedIds: new Set(["used"]),
      knownKeys: new Set(),
      objects: [],
      now,
    });
    expect(unusedDocFiles.map((f) => f.id)).toEqual(["gone"]);
  });

  it("deletes only old objects with no row under known prefixes", () => {
    const { orphanKeys } = planSweep({
      docFiles: [],
      referencedIds: new Set(),
      knownKeys: new Set(["attachments/t/kept.png"]),
      objects: [
        { key: "attachments/t/kept.png", lastModified: old },
        { key: "attachments/t/abandoned.png", lastModified: old },
        { key: "docs/p/uploading.png", lastModified: fresh },
        { key: "backups/db.sql", lastModified: old },
      ],
      now,
    });
    expect(orphanKeys).toEqual(["attachments/t/abandoned.png"]);
  });
});
