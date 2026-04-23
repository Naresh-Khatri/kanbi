"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = "Add a description…",
  disabled,
  className,
  minHeight = "72px",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-invert prose-sm max-w-none focus:outline-none",
          "prose-headings:my-2 prose-li:my-0 prose-ol:my-1 prose-p:my-1 prose-ul:my-1",
          "prose-code:rounded prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
          "prose-blockquote:border-l-white/20 prose-blockquote:text-white/70",
          "prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline",
          className,
        ),
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
      <BubbleMenu
        className="z-[100] flex items-center gap-0.5 rounded-lg border border-white/10 bg-neutral-900 p-1 shadow-xl"
        editor={editor}
        options={{ placement: "top", strategy: "fixed", offset: 8 }}
        updateDelay={150}
      >
        <ToolbarButton
          active={editor.isActive("bold")}
          label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          label="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          label="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          active={editor.isActive("code")}
          label="Code"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("link")}
          label="Link"
          onClick={() => {
            const prev = editor.getAttributes("link").href as
              | string
              | undefined;
            const url = window.prompt("URL", prev ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: url })
              .run();
          }}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          label="Ordered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          label="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded text-white/80 transition-colors hover:bg-white/10 hover:text-white",
        active && "bg-white/15 text-white",
      )}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-4 w-px bg-white/10" />;
}
