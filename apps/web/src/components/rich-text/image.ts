import type { Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";

import { toastManager } from "@/components/ui/toast";
import { FILE_SRC_RE } from "@/lib/file-url";

/**
 * Only attachment urls survive parsing, so pasted html can't smuggle in
 * tracking pixels. The editable editor also keeps blob: previews.
 */
export function createImageExtension(opts: { allowBlob: boolean }) {
  const ok = (src: string | null) =>
    !!src &&
    (FILE_SRC_RE.test(src) || (opts.allowBlob && src.startsWith("blob:")));
  return Image.extend({
    parseHTML() {
      return [
        {
          tag: "img[src]",
          getAttrs: (el) => (ok(el.getAttribute("src")) ? null : false),
        },
      ];
    },
    // markdown paste skips parseHTML, so filter here too
    parseMarkdown: (token, helpers) =>
      ok(token.href ?? null)
        ? helpers.createNode("image", {
            src: token.href,
            title: token.title,
            alt: token.text,
          })
        : [],
  });
}

export const IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
];

export const imageFiles = (list: FileList | null | undefined) =>
  [...(list ?? [])].filter((f) => IMAGE_MIME_TYPES.includes(f.type));

/** Opens the native image picker; detached input so it survives editor chrome hiding. */
export function pickImages(onFiles: (files: File[]) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = IMAGE_MIME_TYPES.join(",");
  input.multiple = true;
  input.onchange = () => {
    const files = imageFiles(input.files);
    if (files.length > 0) onFiles(files);
  };
  input.click();
}

function patchImage(editor: Editor, src: string, next: string | null) {
  if (editor.isDestroyed) return;
  const { tr } = editor.state;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "image" || node.attrs.src !== src) return;
    const at = tr.mapping.map(pos);
    if (next) tr.setNodeMarkup(at, undefined, { ...node.attrs, src: next });
    else tr.delete(at, at + node.nodeSize);
  });
  if (tr.docChanged) editor.view.dispatch(tr);
}

/** Blob preview now, swapped for the attachment url once uploaded. */
export function insertImages(
  editor: Editor,
  files: File[],
  upload: (file: File) => Promise<string>,
  track: (delta: number) => void,
  pos?: number,
) {
  files.forEach((file, i) => {
    const blob = URL.createObjectURL(file);
    const node = { type: "image", attrs: { src: blob, alt: file.name } };
    const chain = editor.chain().focus();
    // later files follow the cursor, which sits after the previous insert
    (pos === undefined || i > 0
      ? chain.insertContent(node)
      : chain.insertContentAt(pos, node)
    ).run();
    track(1);
    upload(file)
      .then((url) => patchImage(editor, blob, url))
      .catch((err: unknown) => {
        patchImage(editor, blob, null);
        toastManager.add({
          type: "error",
          title: `Couldn't upload ${file.name}`,
          description: err instanceof Error ? err.message : undefined,
        });
      })
      .finally(() => {
        URL.revokeObjectURL(blob);
        track(-1);
      });
  });
}
