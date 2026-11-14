import sanitizeHtml from "sanitize-html";

import { FILE_SRC_RE } from "@/lib/file-url";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "a",
    "span",
    "hr",
    "img",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel"],
    span: ["data-type", "data-id", "data-label"],
    img: ["src", "alt", "width"],
  },
  // only our own attachment route: no tracking pixels or hotlinks
  exclusiveFilter: (frame) =>
    frame.tag === "img" && !FILE_SRC_RE.test(frame.attribs.src ?? ""),
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer nofollow",
    }),
  },
};

/** Pure implementation used by the server boundary and its unit tests. */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
