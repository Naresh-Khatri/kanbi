"use client";

import Mention from "@tiptap/extension-mention";
import { Plugin } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
  SuggestionProps,
} from "@tiptap/suggestion";
import { Hash } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

export type MentionItem = { id: string; label: string; image: string | null };
/** A mentionable ticket: id is the task id, label is the "KEY-123" identifier. */
export type TicketMentionItem = { id: string; label: string; title: string };

/** Tailwind class applied to a rendered user-mention chip (editor + read-only). */
const MENTION_CLASS =
  "rounded bg-blue-500/15 px-1 py-0.5 font-medium text-blue-300";
/** Ticket-mention chip — visually distinct from user mentions, and clickable. */
const TICKET_CLASS =
  "cursor-pointer rounded bg-violet-500/15 px-1 py-0.5 font-medium text-violet-300 no-underline hover:bg-violet-500/25";

/** Fired when a ticket chip is clicked in a read-only render; the board view listens. */
export const OPEN_TASK_EVENT = "kanbi:open-task";

type SuggestionHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

// ── User @-mentions ──────────────────────────────────────────────────────────

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

// ── Ticket #-mentions ────────────────────────────────────────────────────────

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

/** Mention extension with an @-autocomplete dropdown backed by `getItems`. */
export function createMentionExtension(getItems: () => MentionItem[]) {
  return Mention.configure({
    HTMLAttributes: { class: MENTION_CLASS },
    suggestion: buildSuggestion(getItems),
  });
}

/** Render-only user mention node (no autocomplete) for read-only content. */
export const mentionRenderExtension = Mention.configure({
  HTMLAttributes: { class: MENTION_CLASS },
});

/**
 * A distinct mention node (`data-type="ticket"`) for ticket references. It
 * renders the bare "KEY-123" label (no leading `#`) and, in read-only editors,
 * dispatches an {@link OPEN_TASK_EVENT} on click so the board can open the task.
 */
const TicketMention = Mention.extend({
  name: "ticket",
  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      { ...HTMLAttributes, "data-type": "ticket" },
      `${node.attrs.label ?? node.attrs.id}`,
    ];
  },
  renderText({ node }) {
    return `${node.attrs.label ?? node.attrs.id}`;
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        props: {
          handleClickOn: (view, _pos, node) => {
            if (node.type.name !== "ticket") return false;
            const id = node.attrs.id as string | null;
            // In an editable editor leave the click alone (select/edit); only
            // navigate from read-only renders.
            if (!id || view.editable) return false;
            window.dispatchEvent(
              new CustomEvent(OPEN_TASK_EVENT, { detail: { taskId: id } }),
            );
            return true;
          },
        },
      }),
    ];
  },
});

/** Ticket mention extension with a #-autocomplete dropdown backed by `getItems`. */
export function createTicketMentionExtension(
  getItems: () => TicketMentionItem[],
) {
  return TicketMention.configure({
    HTMLAttributes: { class: TICKET_CLASS },
    suggestion: buildTicketSuggestion(getItems),
  });
}

/** Render-only ticket mention node (no autocomplete) for read-only content. */
export const ticketMentionRenderExtension = TicketMention.configure({
  HTMLAttributes: { class: TICKET_CLASS },
});
