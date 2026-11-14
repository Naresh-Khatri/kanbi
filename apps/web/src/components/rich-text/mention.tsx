"use client";

import { mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  NodeViewWrapper,
  type NodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { HashIcon } from "lucide-react";
import { cloneElement } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { HoverCard, PersonCard, TaskCard, useOpenTask } from "./hover-card";
import {
  SuggestionMenu,
  suggestionPopup,
  type SuggestionListProps,
  useSuggestionNav,
} from "./suggestion";

export type MentionItem = {
  id: string;
  label: string;
  image: string | null;
  /** Secondary line for the hover card (e.g. email). */
  sublabel?: string | null;
};
/** A mentionable ticket: id is the task id, label is the "KEY-123" identifier. */
export type TicketMentionItem = {
  id: string;
  label: string;
  title: string;
  /** Extra context surfaced in the hover card. */
  status?: string;
  priority?: string;
  assignee?: string | null;
  /** Route fallback for readers outside the mounted board view. */
  href?: string;
};

const MENTION_CLASS =
  "rounded-sm bg-info/12 px-1 py-0.5 font-medium text-info-foreground";
// tickets read as identifiers (mono) vs people; clickable in read-only renders
const TICKET_CLASS =
  "cursor-pointer rounded-sm bg-muted px-1 py-0.5 font-medium font-mono text-[0.9em] text-foreground no-underline hover:bg-accent";

/** User-mention chip: "@Name" with a person hover card. */
function MentionChip({
  node,
  getItems,
}: {
  node: ProseMirrorNode;
  getItems: () => MentionItem[];
}) {
  const id = (node.attrs.id as string | null) ?? null;
  const name = (node.attrs.label as string | null) ?? id ?? "";
  const item = id ? getItems().find((i) => i.id === id) : undefined;

  const chip = (
    <span
      className={MENTION_CLASS}
      data-id={id ?? undefined}
      data-type="mention"
    />
  );
  return (
    <NodeViewWrapper as="span" className="inline">
      {item ? (
        <HoverCard
          className="w-auto max-w-72"
          content={<PersonCard item={item} />}
          trigger={chip}
        >
          @{name}
        </HoverCard>
      ) : (
        cloneElement(chip, undefined, `@${name}`)
      )}
    </NodeViewWrapper>
  );
}

/** Ticket-mention chip: "KEY-123" that opens the task, with a task hover card. */
function TicketChip({
  node,
  editor,
  getItems,
}: {
  node: ProseMirrorNode;
  editor: Editor;
  getItems: () => TicketMentionItem[];
}) {
  const openTask = useOpenTask();
  const id = (node.attrs.id as string | null) ?? null;
  const label = (node.attrs.label as string | null) ?? id ?? "";
  const item = id ? getItems().find((i) => i.id === id) : undefined;

  const chip = (
    <span
      className={TICKET_CLASS}
      data-id={id ?? undefined}
      data-type="ticket"
      // editable: click places the cursor; the card's button still opens
      onClick={() => {
        if (id && !editor.isEditable) openTask({ id, href: item?.href });
      }}
    />
  );
  return (
    <NodeViewWrapper as="span" className="inline">
      {item ? (
        <HoverCard content={<TaskCard item={item} />} trigger={chip}>
          {label}
        </HoverCard>
      ) : (
        cloneElement(chip, undefined, label)
      )}
    </NodeViewWrapper>
  );
}

// ── suggestion lists ─────────────────────────────────────────────────────────

const pick = (item: { id: string; label: string }) => ({
  id: item.id,
  label: item.label,
});

function MentionList({
  items,
  command,
  ref,
}: SuggestionListProps<MentionItem>) {
  const nav = useSuggestionNav(items, (i) => command(pick(i)), ref);
  return (
    <SuggestionMenu
      items={items}
      keyOf={(i) => i.id}
      label="Mention a teammate"
      onHover={nav.setSelected}
      onSelect={nav.select}
      selected={nav.selected}
    >
      {(item) => (
        <>
          <UserAvatar image={item.image} name={item.label} size={20} />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </SuggestionMenu>
  );
}

function TicketList({
  items,
  command,
  ref,
}: SuggestionListProps<TicketMentionItem>) {
  const nav = useSuggestionNav(items, (i) => command(pick(i)), ref);
  return (
    <SuggestionMenu
      className="w-72"
      items={items}
      keyOf={(i) => i.id}
      label="Link a task"
      onHover={nav.setSelected}
      onSelect={nav.select}
      selected={nav.selected}
    >
      {(item) => (
        <>
          <HashIcon aria-hidden="true" />
          <span className="text-muted-foreground shrink-0 font-mono text-xs">
            {item.label}
          </span>
          <span className="truncate">{item.title}</span>
        </>
      )}
    </SuggestionMenu>
  );
}

function buildSuggestion(
  getItems: () => MentionItem[],
): Omit<SuggestionOptions<MentionItem>, "editor"> {
  return {
    items: ({ query }) => {
      const q = query.toLowerCase();
      return getItems()
        .filter(
          (i) =>
            i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q),
        )
        .slice(0, 8);
    },
    render: suggestionPopup(MentionList),
  };
}

function buildTicketSuggestion(
  getItems: () => TicketMentionItem[],
): Omit<SuggestionOptions<TicketMentionItem>, "editor"> {
  return {
    char: "#",
    items: ({ query }) => {
      const q = query.toLowerCase();
      return getItems()
        .filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.title.toLowerCase().includes(q),
        )
        .slice(0, 8);
    },
    render: suggestionPopup(TicketList),
  };
}

// ── Extensions ───────────────────────────────────────────────────────────────

function userMention(getItems: () => MentionItem[]) {
  return Mention.extend({
    addNodeView() {
      return ReactNodeViewRenderer((props: NodeViewProps) => (
        <MentionChip getItems={getItems} node={props.node} />
      ));
    },
  });
}

/** Mention extension with an @-autocomplete dropdown backed by `getItems`. */
export function createMentionExtension(getItems: () => MentionItem[]) {
  return userMention(getItems).configure({
    HTMLAttributes: { class: MENTION_CLASS },
    suggestion: buildSuggestion(getItems),
  });
}

/** Render-only user mention (no autocomplete) for read-only content. */
export function createMentionRenderExtension(getItems: () => MentionItem[]) {
  return userMention(getItems).configure({
    HTMLAttributes: { class: MENTION_CLASS },
  });
}

/**
 * A distinct mention node (`data-type="ticket"`) for ticket references. It
 * renders the bare "KEY-123" label (no leading `#`); the node view turns it into
 * a clickable badge with a summary hover card.
 */
const TicketMention = Mention.extend({
  name: "ticket",
  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        { "data-type": "ticket" },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      `${node.attrs.label ?? node.attrs.id}`,
    ];
  },
  renderText({ node }) {
    return `${node.attrs.label ?? node.attrs.id}`;
  },
});

function ticketMention(getItems: () => TicketMentionItem[]) {
  return TicketMention.extend({
    addNodeView() {
      return ReactNodeViewRenderer((props: NodeViewProps) => (
        <TicketChip
          editor={props.editor}
          getItems={getItems}
          node={props.node}
        />
      ));
    },
  });
}

/** Ticket mention extension with a #-autocomplete dropdown backed by `getItems`. */
export function createTicketMentionExtension(
  getItems: () => TicketMentionItem[],
) {
  return ticketMention(getItems).configure({
    HTMLAttributes: { class: TICKET_CLASS },
    suggestion: buildTicketSuggestion(getItems),
  });
}

/** Render-only ticket mention (no autocomplete) for read-only content. */
export function createTicketRenderExtension(
  getItems: () => TicketMentionItem[],
) {
  return ticketMention(getItems).configure({
    HTMLAttributes: { class: TICKET_CLASS },
  });
}
