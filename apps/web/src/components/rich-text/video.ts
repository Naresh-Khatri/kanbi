import { mergeAttributes, Node } from "@tiptap/core";

import { FILE_SRC_RE } from "@/lib/file-url";

/** Inline clip from an attachment; agents embed these to show interactions. */
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video[src]",
        getAttrs: (el) =>
          FILE_SRC_RE.test(el.getAttribute("src") ?? "") ? null : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        controls: "true",
        preload: "metadata",
        playsinline: "true",
      }),
    ];
  },
});
