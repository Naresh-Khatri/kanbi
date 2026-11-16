import { Marked } from "marked";

import { isInlineImageSrc, isVideoFilename } from "./file-url";

const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const marked = new Marked({
  gfm: true,
  // agents write github-comment style: single newline = line break
  breaks: true,
  renderer: {
    // agent text is untrusted; raw html shows as text, not markup
    html: ({ text, block }) =>
      block ? `<p>${escape(text.trim())}</p>` : escape(text),
    // upload refs carry the filename; confirmed /api/files urls only the alt
    image: ({ href, text }) =>
      !isInlineImageSrc(href)
        ? escape(text)
        : isVideoFilename(href) || isVideoFilename(text)
          ? `<video src="${escape(href)}" title="${escape(text)}"></video>`
          : `<img src="${escape(href)}" alt="${escape(text)}">`,
    // editor has no task lists
    checkbox: () => "",
  },
});

/** Agent markdown (GFM) -> editor HTML. Output still goes through sanitizeRichText. */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }).trim();
}
