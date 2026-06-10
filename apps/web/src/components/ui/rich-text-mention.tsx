"use client";

import { mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  NodeViewWrapper,
  type NodeViewProps,
  ReactNodeViewRenderer,
  ReactRenderer,
} from "@tiptap/react";
import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
  SuggestionProps,
} from "@tiptap/suggestion";
import { ArrowUpRight, Hash } from "lucide-react";
import { HoverCard } from "radix-ui";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

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
};

/** Tailwind class applied to a rendered user-mention chip (editor + read-only). */
const MENTION_CLASS =
  "rounded bg-blue-500/15 px-1 py-0.5 font-medium text-blue-300";
/** Ticket-mention chip — visually distinct from user mentions, and clickable. */
const TICKET_CLASS =
  "cursor-pointer rounded bg-violet-500/15 px-1 py-0.5 font-medium text-violet-300 no-underline hover:bg-violet-500/25";
/** Shared dark hover-card surface. */
const HOVER_CONTENT_CLASS =
  "z-[200] w-64 rounded-lg border border-white/10 bg-[#14151c] p-3 text-white shadow-xl";

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "",
};

/** Fired when a ticket chip is clicked in a read-only render; the board view listens. */
export const OPEN_TASK_EVENT = "kanbi:open-task";

type SuggestionHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

// ── Hover-card node views ────────────────────────────────────────────────────

/** User-mention chip: "@Name" badge with an avatar/email hover card. */
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
    <span className={MENTION_CLASS} data-id={id ?? undefined} data-type="mention">
      @{name}
    </span>
  );
  if (!item) {
    return (
      <NodeViewWrapper as="span" className="inline">
        {chip}
      </NodeViewWrapper>
    );
  }
  return (
    <NodeViewWrapper as="span" className="inline">
      <HoverCard.Root closeDelay={100} openDelay={150}>
        <HoverCard.Trigger asChild>{chip}</HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Content
            className={HOVER_CONTENT_CLASS}
            side="top"
            sideOffset={6}
            style={{ pointerEvents: "auto" }}
          >
            <div className="flex items-center gap-2.5">
              <UserAvatar image={item.image} name={item.label} size={36} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{item.label}</div>
                {item.sublabel ? (
                  <div className="truncate text-xs text-white/50">
                    {item.sublabel}
                  </div>
                ) : null}
              </div>
            </div>
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
    </NodeViewWrapper>
  );
}

/** Ticket-mention chip: "KEY-123" badge that opens the task and shows a summary card. */
function TicketChip({
  node,
  editor,
  getItems,
}: {
  node: ProseMirrorNode;
  editor: Editor;
  getItems: () => TicketMentionItem[];
}) {
  const id = (node.attrs.id as string | null) ?? null;
  const label = (node.attrs.label as string | null) ?? id ?? "";
  const item = id ? getItems().find((i) => i.id === id) : undefined;

  const openTask = () => {
    if (!id) return;
    window.dispatchEvent(
      new CustomEvent(OPEN_TASK_EVENT, { detail: { taskId: id } }),
    );
  };
  const onChipClick = () => {
    // Navigate only from read-only renders; in an editable editor a click should
    // place the cursor / select the chip (the hover-card CTA stays available).
    if (editor.isEditable) return;
    openTask();
  };

  const chip = (
    <span
      className={TICKET_CLASS}
      data-id={id ?? undefined}
      data-type="ticket"
      onClick={onChipClick}
    >
      {label}
    </span>
  );
  if (!item) {
    return (
      <NodeViewWrapper as="span" className="inline">
        {chip}
      </NodeViewWrapper>
    );
  }

  const priority =
    item.priority && item.priority !== "none"
      ? (PRIORITY_LABEL[item.priority] ?? item.priority)
      : null;
  const meta = [item.status, priority, item.assignee].filter(Boolean);

  return (
    <NodeViewWrapper as="span" className="inline">
      <HoverCard.Root closeDelay={100} openDelay={150}>
        <HoverCard.Trigger asChild>{chip}</HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Content
            className={HOVER_CONTENT_CLASS}
            side="top"
            sideOffset={6}
            style={{ pointerEvents: "auto" }}
          >
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-violet-300">
                {item.label}
              </span>
              <span className="text-sm font-medium leading-snug">
                {item.title}
              </span>
              {meta.length > 0 ? (
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-white/50">
                  {meta.map((m, i) => (
                    <span className="flex items-center gap-1.5" key={i}>
                      {i > 0 ? <span className="text-white/25">·</span> : null}
                      {m}
                    </span>
                  ))}
                </span>
              ) : null}
              <button
                className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                onClick={openTask}
                type="button"
              >
                <ArrowUpRight className="h-3.5 w-3.5" /> Open task
              </button>
            </div>
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
    </NodeViewWrapper>
  );
}

// ── User @-mention suggestion list ───────────────────────────────────────────

type MentionListProps = {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
};

const MentionList = forwardRef<SuggestionHandle, MentionListProps>(
  function MentionList({ items, command }, ref) {
    const [selected, setSelected] = useState(0);

    useEffect(() => setSelected(0), [items]);

    const select = (index: number) => {
      const item = items[index];
      if (item) command({ id: item.id, label: item.label });
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelected((s) => (s + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          select(selected);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="min-w-[180px] overflow-hidden rounded-md border border-white/10 bg-neutral-900 p-1 shadow-xl">
        {items.map((item, i) => (
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition",
              i === selected
                ? "bg-white/10 text-white"
                : "text-white/80 hover:bg-white/5",
            )}
            key={item.id}
            onClick={() => select(i)}
            onMouseEnter={() => setSelected(i)}
            type="button"
          >
            <UserAvatar image={item.image} name={item.label} size={20} />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    );
  },
);

// ── Ticket #-mention suggestion list ─────────────────────────────────────────

type TicketListProps = {
  items: TicketMentionItem[];
  command: (item: { id: string; label: string }) => void;
};

const TicketList = forwardRef<SuggestionHandle, TicketListProps>(
  function TicketList({ items, command }, ref) {
    const [selected, setSelected] = useState(0);

    useEffect(() => setSelected(0), [items]);

    const select = (index: number) => {
      const item = items[index];
      if (item) command({ id: item.id, label: item.label });
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelected((s) => (s + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          select(selected);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="max-h-64 min-w-[240px] overflow-y-auto rounded-md border border-white/10 bg-neutral-900 p-1 shadow-xl">
        {items.map((item, i) => (
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition",
              i === selected
                ? "bg-white/10 text-white"
                : "text-white/80 hover:bg-white/5",
            )}
            key={item.id}
            onClick={() => select(i)}
            onMouseEnter={() => setSelected(i)}
            type="button"
          >
            <Hash className="h-3.5 w-3.5 shrink-0 text-violet-300" />
            <span className="shrink-0 font-medium text-violet-300">
              {item.label}
            </span>
            <span className="truncate text-white/60">{item.title}</span>
          </button>
        ))}
      </div>
    );
  },
);

// ── Shared suggestion popup plumbing ─────────────────────────────────────────

/** Create the body-mounted popup container shared by both suggestion menus. */
function createPopup() {
  const popup = document.createElement("div");
  popup.style.position = "fixed";
  popup.style.zIndex = "200";
  // Re-enable pointer events: a modal Radix dialog sets the body to
  // pointer-events:none, which would otherwise swallow clicks here.
  popup.style.pointerEvents = "auto";
  document.body.appendChild(popup);

  const place = (clientRect?: (() => DOMRect | null) | null) => {
    if (!clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 6}px`;
  };

  return { popup, place };
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
    render: () => {
      let component: ReactRenderer<SuggestionHandle, MentionListProps> | null =
        null;
      let mount: ReturnType<typeof createPopup> | null = null;

      return {
        onStart: (props: SuggestionProps<MentionItem>) => {
          component = new ReactRenderer(MentionList, {
            editor: props.editor,
            props,
          });
          mount = createPopup();
          mount.popup.appendChild(component.element);
          mount.place(props.clientRect);
        },
        onUpdate: (props: SuggestionProps<MentionItem>) => {
          component?.updateProps(props);
          mount?.place(props.clientRect);
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === "Escape") {
            mount?.popup.remove();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          mount?.popup.remove();
          mount = null;
          component?.destroy();
          component = null;
        },
      };
    },
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
    render: () => {
      let component: ReactRenderer<SuggestionHandle, TicketListProps> | null =
        null;
      let mount: ReturnType<typeof createPopup> | null = null;

      return {
        onStart: (props: SuggestionProps<TicketMentionItem>) => {
          component = new ReactRenderer(TicketList, {
            editor: props.editor,
            props,
          });
          mount = createPopup();
          mount.popup.appendChild(component.element);
          mount.place(props.clientRect);
        },
        onUpdate: (props: SuggestionProps<TicketMentionItem>) => {
          component?.updateProps(props);
          mount?.place(props.clientRect);
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === "Escape") {
            mount?.popup.remove();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          mount?.popup.remove();
          mount = null;
          component?.destroy();
          component = null;
        },
      };
    },
  };
}

// ── Extensions ───────────────────────────────────────────────────────────────

/** Mention node + an avatar/email hover card, parameterized by a live item getter. */
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
