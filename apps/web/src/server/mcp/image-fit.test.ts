import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { fitImage, MAX_INLINE_BYTES } from "./image-fit";

const png = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: "#3366cc" },
  })
    .png()
    .toBuffer();

describe("fitImage", () => {
  it("passes small images through untouched", async () => {
    const bytes = await png(800, 600);
    const fit = await fitImage(bytes, "image/png");
    expect(fit?.data.equals(bytes)).toBe(true);
    expect(fit?.mimeType).toBe("image/png");
  });

  it("shrinks large screenshots to the model's edge", async () => {
    const fit = await fitImage(await png(4000, 3000), "image/png");
    const meta = await sharp(fit!.data).metadata();
    expect([meta.width, meta.height]).toEqual([1568, 1176]);
  });

  it("falls back to jpeg when png is still too heavy", async () => {
    // random noise defeats png compression
    const noise = Buffer.alloc(3000 * 3000 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
    const bytes = await sharp(noise, {
      raw: { width: 3000, height: 3000, channels: 3 },
    })
      .png()
      .toBuffer();
    const fit = await fitImage(bytes, "image/png");
    expect(fit?.mimeType).toBe("image/jpeg");
    expect(fit!.data.byteLength).toBeLessThanOrEqual(MAX_INLINE_BYTES);
  });
});
