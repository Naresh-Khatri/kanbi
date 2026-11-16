/** Stable, auth-checked url for an attachment; stored in rich text instead of expiring presigned urls. */
export const fileUrl = (attachmentId: string) => `/api/files/${attachmentId}`;

export const FILE_SRC_RE = /^\/api\/files\/[A-Za-z0-9_-]+$/;

export const isVideoFilename = (name: string) => /\.(mp4|webm)$/i.test(name);

/** Attachment ids referenced by inline images and videos, deduped, in document order. */
export function extractFileIds(html: string): string[] {
  const ids = new Set<string>();
  for (const m of html.matchAll(
    /<(?:img|video)\b[^>]*?\bsrc="\/api\/files\/([A-Za-z0-9_-]+)"/g,
  )) {
    ids.add(m[1]!);
  }
  return [...ids];
}

// agents reference a just-uploaded file before it has an id: ![alt](kanbi-upload:<key>)
export const UPLOAD_REF_PREFIX = "kanbi-upload:";
const UPLOAD_REF_RE = /kanbi-upload:(attachments\/[A-Za-z0-9_\-./]+)/g;

export function uploadRefKeys(html: string): string[] {
  return [...new Set([...html.matchAll(UPLOAD_REF_RE)].map((m) => m[1]!))];
}

/** Unknown keys are left alone; the sanitizer then drops those imgs. */
export function replaceUploadRefs(html: string, ids: Map<string, string>) {
  return html.replace(UPLOAD_REF_RE, (match, key: string) => {
    const id = ids.get(key);
    return id ? fileUrl(id) : match;
  });
}

/** attachments/<task>/<nanoid>-<name> -> <name> */
export const filenameFromKey = (key: string) =>
  key
    .split("/")
    .pop()!
    .replace(/^[A-Za-z0-9_-]{21}-/, "") || "image";

const UPLOAD_REF_SRC_RE = /^kanbi-upload:attachments\/[A-Za-z0-9_\-./]+$/;

export const isInlineImageSrc = (src: string) =>
  FILE_SRC_RE.test(src) || UPLOAD_REF_SRC_RE.test(src);
