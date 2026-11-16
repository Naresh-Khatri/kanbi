import { describe, expect, it } from "vitest";

import { sanitizeRichText } from "./sanitize-core";

describe("sanitizeRichText images", () => {
  it("keeps images served by the attachment route", () => {
    expect(
      sanitizeRichText('<p>see</p><img src="/api/files/abc" alt="shot">'),
    ).toBe('<p>see</p><img src="/api/files/abc" alt="shot" />');
  });

  it("drops external, data, and unresolved upload images", () => {
    for (const src of [
      "https://evil.dev/pixel.gif",
      "data:image/png;base64,AAAA",
      "kanbi-upload:attachments/t/x.png",
      "blob:http://localhost/1",
    ]) {
      expect(sanitizeRichText(`<p>a</p><img src="${src}">`)).toBe("<p>a</p>");
    }
  });

  it("strips event handlers from kept images", () => {
    expect(
      sanitizeRichText('<img src="/api/files/a" onerror="alert(1)">'),
    ).toBe('<img src="/api/files/a" />');
  });
});

describe("sanitizeRichText videos", () => {
  it("keeps attachment videos and drops foreign ones and extra attrs", () => {
    expect(
      sanitizeRichText(
        '<video src="/api/files/abc" title="clip" autoplay onplay="x()"></video>',
      ),
    ).toBe('<video src="/api/files/abc" title="clip"></video>');
    expect(
      sanitizeRichText('<p>a</p><video src="https://evil.dev/v.mp4"></video>'),
    ).toBe("<p>a</p>");
  });
});
