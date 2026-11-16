import { describe, expect, it } from "vitest";

import {
  extractFileIds,
  filenameFromKey,
  isInlineImageSrc,
  replaceUploadRefs,
  uploadRefKeys,
} from "./file-url";

describe("extractFileIds", () => {
  it("returns attachment ids from inline images, deduped in order", () => {
    expect(
      extractFileIds(
        '<p>a</p><img src="/api/files/b2" alt="x"><img alt="y" src="/api/files/a1"><img src="/api/files/b2">',
      ),
    ).toEqual(["b2", "a1"]);
  });

  it("includes inline videos", () => {
    expect(
      extractFileIds('<video src="/api/files/v1" title="c"></video>'),
    ).toEqual(["v1"]);
  });

  it("ignores links and foreign images", () => {
    expect(
      extractFileIds(
        '<a href="/api/files/x">x</a><img src="https://evil.dev/api/files/y">',
      ),
    ).toEqual([]);
  });
});

describe("upload refs", () => {
  const key = "attachments/t1/V1StGXR8_Z5jdHi6B-myT-shot.png";

  it("finds and replaces known keys, leaving unknown ones", () => {
    const html = `<img src="kanbi-upload:${key}"><img src="kanbi-upload:attachments/t1/other.png">`;
    expect(uploadRefKeys(html)).toEqual([key, "attachments/t1/other.png"]);
    expect(replaceUploadRefs(html, new Map([[key, "att1"]]))).toBe(
      '<img src="/api/files/att1"><img src="kanbi-upload:attachments/t1/other.png">',
    );
  });

  it("strips the nanoid prefix from the stored filename", () => {
    expect(filenameFromKey(key)).toBe("shot.png");
    expect(filenameFromKey("attachments/t1/plain.png")).toBe("plain.png");
  });

  it("accepts only attachment and upload-ref srcs", () => {
    expect(isInlineImageSrc("/api/files/abc")).toBe(true);
    expect(isInlineImageSrc(`kanbi-upload:${key}`)).toBe(true);
    expect(isInlineImageSrc("https://x.dev/a.png")).toBe(false);
    expect(isInlineImageSrc("/api/files/../x")).toBe(false);
  });
});
