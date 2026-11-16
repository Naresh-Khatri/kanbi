import sharp from "sharp";

// claude downsizes past this edge anyway
const MAX_EDGE = 1568;
// base64 inflates ~4/3; keeps each image under the 5 MB model limit
export const MAX_INLINE_BYTES = 3_750_000;

/**
 * Shrink an image to what a model can use. Small images pass through
 * untouched; null when it still can't get under the byte cap.
 */
export async function fitImage(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  const meta = await sharp(bytes).metadata();
  const oversized =
    (meta.width ?? 0) > MAX_EDGE ||
    (meta.pageHeight ?? meta.height ?? 0) > MAX_EDGE;
  if (!oversized && bytes.byteLength <= MAX_INLINE_BYTES) {
    return { data: Buffer.from(bytes), mimeType };
  }

  // first frame only for animations; rotate() applies exif orientation
  const resized = sharp(bytes)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true });
  // png keeps screenshot text crisp; jpeg when that is still too heavy
  const png = await resized.clone().png({ compressionLevel: 9 }).toBuffer();
  if (png.byteLength <= MAX_INLINE_BYTES) {
    return { data: png, mimeType: "image/png" };
  }
  const jpeg = await resized
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80 })
    .toBuffer();
  return jpeg.byteLength <= MAX_INLINE_BYTES
    ? { data: jpeg, mimeType: "image/jpeg" }
    : null;
}
