"use client";

import Placeholder from "@tiptap/extension-placeholder";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from "lucide-react";
import * as React from "react";
import { Toggle } from "@/components/ui/toggle";
import {
  Toolbar,
  ToolbarButton as ToolbarPrimitiveButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/ui/toolbar";
import { cn } from "@/lib/utils";
import {
  createMentionExtension,
  createMentionRenderExtension,
  createTicketMentionExtension,
  createTicketRenderExtension,
  type MentionItem,
  type TicketMentionItem,
} from "./mention";

/** Shared prose styling so the editor and the read-only renderer look identical. */
const RICH_TEXT_PROSE = cn(
  "prose prose-sm dark:prose-invert max-w-none text-foreground",
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
      .replace(/<[^>]*>/g, "")
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
  /** Long-form documents get a persistent toolbar; compact fields use a bubble menu. */
  toolbar?: "bubble" | "document";
}

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
  toolbar = "bubble",
}: RichTextEditorProps) {
  // Keep mention/ticket items fresh (they load async) without re-creating the
  // editor: each extension reads through its ref on every query.
  const enableMentions = mentions !== undefined;
  const mentionsRef = React.useRef<MentionItem[]>(mentions ?? []);
  mentionsRef.current = mentions ?? [];
  const mentionExtension = React.useMemo(
    () =>
      enableMentions ? createMentionExtension(() => mentionsRef.current) : null,
    [enableMentions],
  );

  const enableTickets = tickets !== undefined;
  const ticketsRef = React.useRef<TicketMentionItem[]>(tickets ?? []);
  ticketsRef.current = tickets ?? [];
  const ticketExtension = React.useMemo(
    () =>
      enableTickets
        ? createTicketMentionExtension(() => ticketsRef.current)
        : null,
    [enableTickets],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder }),
      ...(mentionExtension ? [mentionExtension] : []),
      ...(ticketExtension ? [ticketExtension] : []),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(RICH_TEXT_PROSE, "focus:outline-none", className),
        style: `min-height: ${minHeight};`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onBlur: () => onBlur?.(),
  });

  React.useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value)
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;

  return (
    <>
      {toolbar === "document" ? (
        <Toolbar
          aria-label="Formatting"
          className="sticky top-0 z-10 mb-5 flex-wrap gap-1 rounded-none border-x-0 border-t-0 bg-background/80 px-0 py-2 backdrop-blur"
        >
          <ToolbarGroup>
            <FormatToggle
              active={editor.isActive("heading", { level: 1 })}
              label="Heading 1"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
            >
              <Heading1Icon aria-hidden="true" />
            </FormatToggle>
            <FormatToggle
              active={editor.isActive("heading", { level: 2 })}
              label="Heading 2"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              <Heading2Icon aria-hidden="true" />
            </FormatToggle>
          </ToolbarGroup>
          <ToolbarSeparator orientation="vertical" />
          <InlineFormatting editor={editor} />
        </Toolbar>
      ) : null}
      {toolbar === "bubble" ? (
        <BubbleMenu
          className="z-50"
          editor={editor}
          options={{ placement: "top", strategy: "fixed", offset: 8 }}
          updateDelay={150}
        >
          <Toolbar
            aria-label="Formatting"
            className="gap-1 rounded-lg bg-popover shadow-lg/5"
          >
            <InlineFormatting editor={editor} />
          </Toolbar>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
    </>
  );
}

function InlineFormatting({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    const chain = editor.chain().focus().extendMarkRange("link");
    if (url === "") chain.unsetLink().run();
    else chain.setLink({ href: url }).run();
  };
  return (
    <>
      <ToolbarGroup>
        <FormatToggle
          active={editor.isActive("bold")}
          label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={editor.isActive("italic")}
          label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={editor.isActive("underline")}
          label="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={editor.isActive("strike")}
          label="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <StrikethroughIcon aria-hidden="true" />
        </FormatToggle>
      </ToolbarGroup>
      <ToolbarSeparator orientation="vertical" />
      <ToolbarGroup>
        <FormatToggle
          active={editor.isActive("code")}
          label="Code"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={editor.isActive("link")}
          label="Link"
          onClick={setLink}
        >
          <LinkIcon aria-hidden="true" />
        </FormatToggle>
      </ToolbarGroup>
      <ToolbarSeparator orientation="vertical" />
      <ToolbarGroup>
        <FormatToggle
          active={editor.isActive("bulletList")}
          label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={editor.isActive("orderedList")}
          label="Ordered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrderedIcon aria-hidden="true" />
        </FormatToggle>
        <FormatToggle
          active={editor.isActive("blockquote")}
          label="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon aria-hidden="true" />
        </FormatToggle>
      </ToolbarGroup>
    </>
  );
}

function FormatToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <ToolbarPrimitiveButton
      aria-label={label}
      onClick={onClick}
      // keep the editor selection
      onMouseDown={(e) => e.preventDefault()}
      render={
<Toggle pressed={active} size="sm" />
      }
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
      StarterKit.configure({
        link: { openOnClick: true, autolink: true },
      }),
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
