"use client";

import { type Editor, Extension, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import {
  AtSignIcon,
  FileTextIcon,
  HashIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
  SquareCodeIcon,
} from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import {
  SuggestionMenu,
  suggestionPopup,
  type SuggestionListProps,
  useSuggestionNav,
} from "./suggestion";

type SlashCommand = {
  id: string;
  label: string;
  group: "Blocks" | "Insert";
  icon: LucideIcon;
  /** Markdown shortcut that does the same thing. */
  hint?: string;
  keywords?: string;
  run: (editor: Editor, range: Range) => void;
};

export type SlashOptions = {
  headings: (1 | 2 | 3)[];
  mentions: boolean;
  tickets: boolean;
  pages?: boolean;
  onLink: (editor: Editor) => void;
  onImage?: (editor: Editor) => void;
};

const at = (editor: Editor, range: Range) =>
  editor.chain().focus().deleteRange(range);

const HEADING_ICON = { 1: Heading1Icon, 2: Heading2Icon, 3: Heading3Icon };

function commandsFor(opts: SlashOptions): SlashCommand[] {
  return [
    {
      id: "text",
      label: "Text",
      group: "Blocks",
      icon: PilcrowIcon,
      keywords: "paragraph plain",
      run: (e, r) => at(e, r).setParagraph().run(),
    },
    ...opts.headings.map(
      (level): SlashCommand => ({
        id: `h${level}`,
        label: opts.headings.length > 1 ? `Heading ${level}` : "Heading",
        group: "Blocks",
        icon: HEADING_ICON[level],
        hint: `${"#".repeat(level)} `,
        keywords: `h${level} title`,
        run: (e, r) => at(e, r).setHeading({ level }).run(),
      }),
    ),
    {
      id: "bullet",
      label: "Bulleted list",
      group: "Blocks",
      icon: ListIcon,
      hint: "- ",
      keywords: "ul unordered",
      run: (e, r) => at(e, r).toggleBulletList().run(),
    },
    {
      id: "ordered",
      label: "Numbered list",
      group: "Blocks",
      icon: ListOrderedIcon,
      hint: "1. ",
      keywords: "ol ordered",
      run: (e, r) => at(e, r).toggleOrderedList().run(),
    },
    {
      id: "quote",
      label: "Quote",
      group: "Blocks",
      icon: QuoteIcon,
      hint: "> ",
      keywords: "blockquote",
      run: (e, r) => at(e, r).toggleBlockquote().run(),
    },
    {
      id: "code",
      label: "Code block",
      group: "Blocks",
      icon: SquareCodeIcon,
      hint: "```",
      keywords: "pre snippet",
      run: (e, r) => at(e, r).toggleCodeBlock().run(),
    },
    {
      id: "divider",
      label: "Divider",
      group: "Blocks",
      icon: MinusIcon,
      hint: "---",
      keywords: "hr rule separator",
      run: (e, r) => at(e, r).setHorizontalRule().run(),
    },
    {
      id: "link",
      label: "Link",
      group: "Insert",
      icon: LinkIcon,
      keywords: "url href",
      run: (e, r) => {
        at(e, r).run();
        opts.onLink(e);
      },
    },
    ...(opts.tickets
      ? [
          {
            id: "task",
            label: "Mention task",
            group: "Insert",
            icon: HashIcon,
            hint: "#",
            keywords: "ticket issue reference",
            // hands off to the # suggestion
            run: (e, r) => e.chain().focus().insertContentAt(r, "#").run(),
          } satisfies SlashCommand,
        ]
      : []),
    ...(opts.pages
      ? [
          {
            id: "page",
            label: "Link to page",
            group: "Insert",
            icon: FileTextIcon,
            hint: "[[",
            keywords: "doc document reference backlink wiki",
            run: (e, r) => e.chain().focus().insertContentAt(r, "[[").run(),
          } satisfies SlashCommand,
        ]
      : []),
    ...(opts.mentions
      ? [
          {
            id: "person",
            label: "Mention person",
            group: "Insert",
            icon: AtSignIcon,
            hint: "@",
            keywords: "user member teammate",
            run: (e, r) => e.chain().focus().insertContentAt(r, "@").run(),
          } satisfies SlashCommand,
        ]
      : []),
    ...(opts.onImage
      ? [
          {
            id: "image",
            label: "Image",
            group: "Insert",
            icon: ImageIcon,
            keywords: "picture photo upload",
            run: (e, r) => {
              at(e, r).run();
              opts.onImage?.(e);
            },
          } satisfies SlashCommand,
        ]
      : []),
  ];
}

function SlashList({ items, command, ref }: SuggestionListProps<SlashCommand>) {
  const nav = useSuggestionNav(items, command, ref);
  return (
    <SuggestionMenu
      className="w-60"
      groupOf={(c) => c.group}
      items={items}
      keyOf={(c) => c.id}
      label="Insert block"
      onHover={nav.setSelected}
      onSelect={nav.select}
      selected={nav.selected}
    >
      {(c) => (
        <>
          <c.icon aria-hidden="true" />
          <span className="truncate">{c.label}</span>
          {c.hint ? (
            <Kbd className="ms-auto font-mono">{c.hint.trim()}</Kbd>
          ) : null}
        </>
      )}
    </SuggestionMenu>
  );
}

const slashKey = new PluginKey("slashCommand");

/** `/` menu for blocks and inserts; commands outside the editor go through `opts` callbacks. */
export function createSlashExtension(opts: SlashOptions) {
  const commands = commandsFor(opts);
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashCommand, SlashCommand>({
          editor: this.editor,
          char: "/",
          pluginKey: slashKey,
          allow: ({ state, range }) =>
            !state.doc.resolve(range.from).parent.type.spec.code,
          items: ({ query }) => {
            const q = query.toLowerCase();
            return commands.filter((c) =>
              `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q),
            );
          },
          command: ({ editor, range, props }) => props.run(editor, range),
          render: suggestionPopup(SlashList),
        }),
      ];
    },
  });
}
