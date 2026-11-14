"use client";

import type { Editor } from "@tiptap/core";
import FileHandler from "@tiptap/extension-file-handler";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { Fragment, Slice } from "@tiptap/pm/model";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverPopup } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import {
  Toolbar,
  ToolbarButton as ToolbarPrimitiveButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/ui/toolbar";
import { cn } from "@/lib/utils";
import {
  createImageExtension,
  IMAGE_MIME_TYPES,
  insertImages,
  pickImages,
} from "./image";
import { createLinkExtension } from "./link";
import {
  createMentionExtension,
  createMentionRenderExtension,
  createTicketMentionExtension,
  createTicketRenderExtension,
  type MentionItem,
  type TicketMentionItem,
} from "./mention";
import { createSlashExtension } from "./slash";

/** Shared prose styling so the editor and the read-only renderer look identical. */
const RICH_TEXT_PROSE = cn(
  "prose prose-sm dark:prose-invert text-foreground max-w-none",
  "prose-headings:my-2 prose-headings:text-foreground prose-strong:text-foreground prose-li:my-0 prose-ol:my-1 prose-p:my-1 prose-ul:my-1 prose-li:marker:text-muted-foreground",
  "prose-code:rounded-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:text-foreground prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
  "prose-pre:border prose-pre:bg-muted prose-pre:text-foreground",
  "prose-blockquote:border-l-border prose-blockquote:font-normal prose-blockquote:text-muted-foreground prose-blockquote:not-italic",
  "prose-a:text-info-foreground prose-a:underline-offset-2 prose-a:no-underline hover:prose-a:underline",
  "prose-hr:border-border",
);

/**
 * True when rich-text HTML carries no visible content (e.g. an empty `<p></p>`
 * emitted by the editor). Use this to guard submits instead of `html.trim()`.
 */
export function isRichTextEmpty(html: string): boolean {
  return (
    html
      .replace(/<(?!img\b)[^>]*>/g, "")
      .replace(/&nbsp;|&#160;/g, "")
      .trim().length === 0
  );
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
  /** When provided, enables @-mention autocomplete against these members. */
  mentions?: MentionItem[];
  /** When provided, enables #-mention autocomplete against these tickets. */
  tickets?: TicketMentionItem[];
  /**
   * `box` = bordered field; `inline` = reads as plain text until focused;
   * `document` = borderless page with a sticky toolbar.
   */
  variant?: "box" | "inline" | "document";
  /** Enables image paste/drop/pick; resolves to the stored image url. */
  uploadImage?: (file: File) => Promise<string>;
  /** Uploads in flight; block submit while > 0 (body still has blob: srcs). */
  onUploadingChange?: (count: number) => void;
}

/**
 * The one rich-text editor: lean toolbar, markdown shortcuts and markdown
 * paste, image drop/paste/pick. Stores sanitized HTML.
 */
export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = "Add a description…",
  disabled,
  className,
  minHeight = "72px",
  mentions,
  tickets,
  variant = "box",
  uploadImage,
  onUploadingChange,
}: RichTextEditorProps) {
  // Keep mention/ticket items fresh (they load async) without re-creating the
  // editor: each extension reads through its ref on every query.
  const enableMentions = mentions !== undefined;
  const mentionsRef = React.useRef<MentionItem[]>(mentions ?? []);
  mentionsRef.current = mentions ?? [];
  const enableTickets = tickets !== undefined;
  const ticketsRef = React.useRef<TicketMentionItem[]>(tickets ?? []);
  ticketsRef.current = tickets ?? [];

  // extensions are fixed at mount; read the latest callbacks through refs
  const enableUploads = uploadImage !== undefined;
  const uploadRef = React.useRef(uploadImage);
  uploadRef.current = uploadImage;
  const uploadingRef = React.useRef(onUploadingChange);
  uploadingRef.current = onUploadingChange;
  const pending = React.useRef(0);
  const track = React.useCallback((delta: number) => {
    pending.current += delta;
    uploadingRef.current?.(pending.current);
  }, []);
  const upload = React.useCallback(
    (editor: Editor, files: File[], pos?: number) => {
      const fn = uploadRef.current;
      if (fn) insertImages(editor, files, fn, track, pos);
    },
    [track],
  );

  const headings = variant === "document" ? ALL_HEADINGS : SECTION_HEADING;
  // set by the toolbar's link control; lets `/link` open it at the caret
  const requestLink = React.useRef<(() => void) | null>(null);

  const extensions = React.useMemo(
    () => [
      StarterKit.configure({ link: false }),
      createLinkExtension({
        openOnClick: false,
        getTickets: () => ticketsRef.current,
      }),
      Placeholder.configure({ placeholder }),
      Markdown,
      createImageExtension({ allowBlob: true }),
      ...(enableUploads
        ? [
            FileHandler.configure({
              allowedMimeTypes: IMAGE_MIME_TYPES,
              onDrop: (editor, files, pos) => upload(editor, files, pos),
              onPaste: (editor, files) => upload(editor, files),
            }),
          ]
        : []),
      ...(enableMentions
        ? [createMentionExtension(() => mentionsRef.current)]
        : []),
      ...(enableTickets
        ? [createTicketMentionExtension(() => ticketsRef.current)]
        : []),
      createSlashExtension({
        headings,
        mentions: enableMentions,
        tickets: enableTickets,
        onLink: () => requestLink.current?.(),
        onImage: enableUploads
          ? (editor) => pickImages((files) => upload(editor, files))
          : undefined,
      }),
    ],
    [
      placeholder,
      enableMentions,
      enableTickets,
      enableUploads,
      upload,
      headings,
    ],
  );

  const editorRef = React.useRef<Editor | null>(null);
  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          RICH_TEXT_PROSE,
          "focus:outline-none",
          variant === "box" && "px-3 py-2",
          className,
        ),
        style: `min-height: ${minHeight};`,
      },
      // text-only clipboard (editors, terminals, READMEs) = markdown, like GitHub; shift-paste stays plain
      clipboardTextParser: (text, $context, plain, view) => {
        const { schema } = view.state;
        const markdown = editorRef.current?.markdown;
        if (!plain && markdown)
          return Slice.maxOpen(
            schema.nodeFromJSON(markdown.parse(text)).content,
          );
        return Slice.maxOpen(
          Fragment.fromArray(
            text
              .split(/\r\n?|\n/)
              .map((line) =>
                schema.nodes.paragraph!.create(
                  null,
                  line ? schema.text(line, $context.marks()) : null,
                ),
              ),
          ),
        );
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onBlur: () => onBlur?.(),
  });
  editorRef.current = editor;

  // link popover steals focus; keep chrome up while it's open
  const [linkOpen, setLinkOpen] = React.useState(false);
  const focused = useEditorState({
    editor,
    selector: ({ editor: e }) => e?.isFocused ?? false,
  });
  const editing = focused || linkOpen;

  React.useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value)
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;
  if (disabled) return <EditorContent editor={editor} />;

  const toolbar = (
    <EditorToolbar
      editor={editor}
      headings={headings}
      onLinkOpenChange={setLinkOpen}
      requestLink={requestLink}
      onPickImages={
        enableUploads ? (files) => upload(editor, files) : undefined
      }
    />
  );
  // hidden, not unmounted: link popover must survive blur
  const revealed = cn("mt-1 px-1 pb-1", !editing && "hidden");

  if (variant === "document")
    return (
      <>
        <div className="bg-background/80 sticky top-0 z-10 mb-5 border-b py-2 backdrop-blur">
          {toolbar}
        </div>
        <EditorContent editor={editor} />
      </>
    );

  // toolbar sits below the text so revealing it never moves the caret
  if (variant === "inline")
    return (
      <div
        className={cn(
          "-mx-2 cursor-text rounded-lg px-2 py-1 transition-colors",
          editing ? "bg-muted/40" : "hover:bg-accent/50",
        )}
      >
        <EditorContent editor={editor} />
        <div className={revealed}>{toolbar}</div>
      </div>
    );

  return (
    <div className="border-input bg-background ring-ring/24 focus-within:border-ring dark:bg-input/32 rounded-lg border shadow-xs/5 transition-shadow focus-within:ring-[3px]">
      <EditorContent editor={editor} />
      <div className={revealed}>{toolbar}</div>
    </div>
  );
}

type Level = 1 | 2 | 3;
const ALL_HEADINGS: Level[] = [1, 2, 3];
// comments/descriptions only get one heading size
const SECTION_HEADING: Level[] = [3];
const HEADING_ICON = {
  1: Heading1Icon,
  2: Heading2Icon,
  3: Heading3Icon,
} as const;

function EditorToolbar({
  editor,
  headings,
  onLinkOpenChange,
  onPickImages,
  requestLink,
}: {
  editor: Editor;
  headings: Level[];
  onLinkOpenChange?: (open: boolean) => void;
  onPickImages?: (files: File[]) => void;
  requestLink?: React.RefObject<(() => void) | null>;
}) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      heading: Object.fromEntries(
        ([1, 2, 3] as const).map((level) => [
          level,
          e.isActive("heading", { level }),
        ]),
      ) as Record<Level, boolean>,
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <Toolbar
      aria-label="Formatting"
      className="flex-wrap gap-0.5 rounded-none border-0 bg-transparent p-0"
    >
      <ToolbarGroup>
        {headings.map((level) => {
          const Icon = HEADING_ICON[level];
          return (
            <FormatToggle
              active={active.heading[level]}
              key={level}
              label={headings.length > 1 ? `Heading ${level}` : "Heading"}
              onClick={() => chain().toggleHeading({ level }).run()}
            >
              <Icon aria-hidden="true" />
            </FormatToggle>
          );
        })}
        <FormatToggle
          active={active.bold}
          label="Bold"
          onClick={() => chain().toggleBold().run()}
        >
          <BoldIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={active.italic}
          label="Italic"
          onClick={() => chain().toggleItalic().run()}
        >
          <ItalicIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={active.underline}
          label="Underline"
          onClick={() => chain().toggleUnderline().run()}
        >
          <UnderlineIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={active.strike}
          label="Strikethrough"
          onClick={() => chain().toggleStrike().run()}
        >
          <StrikethroughIcon aria-hidden="true" />
        </FormatToggle>
      </ToolbarGroup>
      <ToolbarSeparator orientation="vertical" />
      <ToolbarGroup>
        <FormatToggle
          active={active.code}
          label="Code"
          onClick={() => chain().toggleCode().run()}
        >
          <CodeIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={active.codeBlock}
          label="Code block"
          onClick={() => chain().toggleCodeBlock().run()}
        >
          <SquareCodeIcon aria-hidden="true" />
        </FormatToggle>
        <LinkControl
          active={active.link}
          editor={editor}
          onOpenChange={onLinkOpenChange}
          requestRef={requestLink}
        />
      </ToolbarGroup>
      <ToolbarSeparator orientation="vertical" />
      <ToolbarGroup>
        <FormatToggle
          active={active.bulletList}
          label="Bulleted list"
          onClick={() => chain().toggleBulletList().run()}
        >
          <ListIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={active.orderedList}
          label="Numbered list"
          onClick={() => chain().toggleOrderedList().run()}
        >
          <ListOrderedIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={active.blockquote}
          label="Quote"
          onClick={() => chain().toggleBlockquote().run()}
        >
          <QuoteIcon aria-hidden="true" />
        </FormatToggle>
      </ToolbarGroup>
      {onPickImages ? (
        <>
          <ToolbarSeparator orientation="vertical" />
          <ToolbarGroup>
            <FormatToggle
              active={false}
              label="Image (or paste / drop one)"
              onClick={() => pickImages(onPickImages)}
            >
              <ImageIcon aria-hidden="true" />
            </FormatToggle>
          </ToolbarGroup>
        </>
      ) : null}
    </Toolbar>
  );
}

type VirtualAnchor = { getBoundingClientRect: () => DOMRect };

function LinkControl({
  editor,
  active,
  onOpenChange,
  requestRef,
}: {
  editor: Editor;
  active: boolean;
  onOpenChange?: (open: boolean) => void;
  requestRef?: React.RefObject<(() => void) | null>;
}) {
  const [open, setOpenState] = React.useState(false);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [href, setHref] = React.useState("");
  const anchor = React.useRef<HTMLButtonElement>(null);
  const [caret, setCaret] = React.useState<VirtualAnchor | null>(null);

  const show = (at: VirtualAnchor | null) => {
    setHref((editor.getAttributes("link").href as string | undefined) ?? "");
    setCaret(at);
    setOpen(true);
  };

  React.useEffect(() => {
    if (!requestRef) return;
    requestRef.current = () => {
      const c = editor.view.coordsAtPos(editor.state.selection.from);
      const rect = new DOMRect(c.left, c.top, 0, c.bottom - c.top);
      show({ getBoundingClientRect: () => rect });
    };
    return () => {
      requestRef.current = null;
    };
  });

  const apply = () => {
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!url) chain.unsetLink().run();
    else if (editor.state.selection.empty && !active)
      chain
        .insertContent({
          type: "text",
          text: url,
          marks: [{ type: "link", attrs: { href: url } }],
        })
        .run();
    else chain.setLink({ href: url }).run();
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <FormatToggle
        active={active}
        label="Link"
        onClick={() => show(null)}
        ref={anchor}
      >
        <LinkIcon aria-hidden="true" />
      </FormatToggle>
      <PopoverPopup align="start" anchor={caret ?? anchor} className="w-72">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <Input
            aria-label="Link URL"
            autoFocus
            onChange={(e) => setHref(e.target.value)}
            placeholder="https://"
            size="sm"
            type="url"
            value={href}
          />
          <Button size="sm" type="submit">
            {href.trim() || !active ? "Save" : "Remove"}
          </Button>
        </form>
      </PopoverPopup>
    </Popover>
  );
}

function FormatToggle({
  active,
  onClick,
  label,
  children,
  ref,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <ToolbarPrimitiveButton
      aria-label={label}
      onClick={onClick}
      // keep the editor selection
      onMouseDown={(e) => e.preventDefault()}
      ref={ref}
      render={<Toggle pressed={active} size="sm" />}
      title={label}
    >
      {children}
    </ToolbarPrimitiveButton>
  );
}

/**
 * Read-only renderer for rich-text HTML produced by {@link RichTextEditor}.
 * Parses the HTML through the same ProseMirror schema (so only known nodes /
 * marks survive — no `dangerouslySetInnerHTML`, no XSS) and applies identical
 * prose styling. Use this anywhere stored rich text is displayed.
 */
export function RichTextContent({
  value,
  className,
  mentions,
  tickets,
}: {
  value: string;
  className?: string;
  /** Resolves @-mention chips to a hover card with avatar/email. */
  mentions?: MentionItem[];
  /** Resolves #-ticket chips to a hover card + click-to-open. */
  tickets?: TicketMentionItem[];
}) {
  // Keep hover-card data fresh (it loads async) without recreating the editor.
  const mentionsRef = React.useRef<MentionItem[]>(mentions ?? []);
  mentionsRef.current = mentions ?? [];
  const ticketsRef = React.useRef<TicketMentionItem[]>(tickets ?? []);
  ticketsRef.current = tickets ?? [];
  const extensions = React.useMemo(
    () => [
      StarterKit.configure({ link: false }),
      createLinkExtension({
        openOnClick: true,
        getTickets: () => ticketsRef.current,
      }),
      createImageExtension({ allowBlob: false }),
      createMentionRenderExtension(() => mentionsRef.current),
      createTicketRenderExtension(() => ticketsRef.current),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: value,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: cn(RICH_TEXT_PROSE, className) },
      handleClickOn: (_view, _pos, node) => {
        if (node.type.name !== "image") return false;
        window.open(String(node.attrs.src), "_blank", "noopener");
        return true;
      },
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value)
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}
