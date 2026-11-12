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
import { ArrowUpRightIcon, HashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  cloneElement,
  forwardRef,
  useEffect, useImperativeHandle, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import { UserAvatar } from "@/components/user-avatar";
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
  /** Route fallback for readers outside the mounted board view. */
  href?: string;
};

const MENTION_CLASS =
  "rounded-sm bg-info/12 px-1 py-0.5 font-medium text-info-foreground";
// tickets read as identifiers (mono) vs people; clickable in read-only renders
const TICKET_CLASS =
  "cursor-pointer rounded-sm bg-muted px-1 py-0.5 font-medium font-mono text-[0.9em] text-foreground no-underline hover:bg-accent";

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

const PREVIEW_DELAY = 150;
const PREVIEW_CLOSE_DELAY = 100;

/** User-mention chip: "@Name" with an avatar/email preview card. */
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
  if (!item) {
    return (
      <NodeViewWrapper as="span" className="inline">
        {cloneElement(chip, undefined, `@${name}`)}
      </NodeViewWrapper>
    );
  }
  return (
    <NodeViewWrapper as="span" className="inline">
      <PreviewCard>
        <PreviewCardTrigger
          closeDelay={PREVIEW_CLOSE_DELAY}
          delay={PREVIEW_DELAY}
          render={chip}
        >
          @{name}
        </PreviewCardTrigger>
        <PreviewCardPopup className="w-auto max-w-72 p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <UserAvatar image={item.image} name={item.label} size={36} />
            <div className="min-w-0">
              <div className="truncate font-medium text-sm">{item.label}</div>
              {item.sublabel ? (
                <div className="truncate text-muted-foreground text-xs">
                  {item.sublabel}
                </div>
              ) : null}
            </div>
          </div>
        </PreviewCardPopup>
      </PreviewCard>
    </NodeViewWrapper>
  );
}

/** Ticket-mention chip: "KEY-123" that opens the task, with a summary preview card. */
function TicketChip({
  node,
  editor,
  getItems,
}: {
  node: ProseMirrorNode;
  editor: Editor;
  getItems: () => TicketMentionItem[];
}) {
  const router = useRouter();
  const id = (node.attrs.id as string | null) ?? null;
  const label = (node.attrs.label as string | null) ?? id ?? "";
  const item = id ? getItems().find((i) => i.id === id) : undefined;

  const openTask = () => {
    if (!id) return;
    if (item?.href) {
      router.push(item.href);
      return;
    }
    window.dispatchEvent(
      new CustomEvent(OPEN_TASK_EVENT, { detail: { taskId: id } }),
    );
  };
  // editable editor: click places the cursor; preview card CTA still opens
  const onChipClick = () => {
    if (editor.isEditable) return;
    openTask();
  };

  const chip = (
    <span
      className={TICKET_CLASS}
      data-id={id ?? undefined}
      data-type="ticket"
      onClick={onChipClick}
    />
  );
  if (!item) {
    return (
      <NodeViewWrapper as="span" className="inline">
        {cloneElement(chip, undefined, label)}
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
      <PreviewCard>
        <PreviewCardTrigger
          closeDelay={PREVIEW_CLOSE_DELAY}
          delay={PREVIEW_DELAY}
          render={chip}
        >
          {label}
        </PreviewCardTrigger>
        <PreviewCardPopup className="flex-col gap-1.5 p-3">
          <span className="font-mono text-muted-foreground text-xs">
            {item.label}
          </span>
          <span className="font-medium text-sm leading-snug">
            {item.title}
          </span>
          {meta.length > 0 ? (
            <span className="text-muted-foreground text-xs">
              {meta.join(" · ")}
            </span>
          ) : null}
          <Button
            className="mt-1"
            onClick={openTask}
            size="xs"
            type="button"
            variant="outline"
          >
            <ArrowUpRightIcon aria-hidden="true" />
            Open task
          </Button>
        </PreviewCardPopup>
      </PreviewCard>
    </NodeViewWrapper>
  );
}

// ── suggestion lists (styled as a coss menu popup) ───────────────────────────

type ListProps<T> = {
  items: T[];
  command: (item: { id: string; label: string }) => void;
};

function useSuggestionNav<T extends { id: string; label: string }>(
  { items, command }: ListProps<T>,
  ref: React.ForwardedRef<SuggestionHandle>,
) {
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

  return { selected, setSelected, select };
}

function SuggestionMenu<T extends { id: string }>({
  items,
  selected,
  onHover,
  onSelect,
  label,
  className,
  children,
}: {
  items: T[];
  selected: number;
  onHover: (i: number) => void;
  onSelect: (i: number) => void;
  label: string;
  className?: string;
  children: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div
      aria-label={label}
      className={cn(
        "relative max-h-64 min-w-48 overflow-y-auto rounded-lg border bg-popover not-dark:bg-clip-padding p-1 text-popover-foreground shadow-lg/5",
        className,
      )}
      role="listbox"
    >
      {items.map((item, i) => (
        <div
          aria-selected={i === selected}
          className="flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground sm:min-h-7 sm:text-sm [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:opacity-80"
          key={item.id}
          onClick={() => onSelect(i)}
          // keep focus in the editor
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onHover(i)}
          role="option"
          tabIndex={-1}
        >
          {children(item)}
        </div>
      ))}
    </div>
  );
}

const MentionList = forwardRef<SuggestionHandle, ListProps<MentionItem>>(
  function MentionList(props, ref) {
    const { selected, setSelected, select } = useSuggestionNav(props, ref);
    return (
      <SuggestionMenu
        items={props.items}
        label="Mention a teammate"
        onHover={setSelected}
        onSelect={select}
        selected={selected}
      >
        {(item) => (
          <>
            <UserAvatar image={item.image} name={item.label} size={20} />
            <span className="truncate">{item.label}</span>
          </>
        )}
      </SuggestionMenu>
    );
  },
);

const TicketList = forwardRef<SuggestionHandle, ListProps<TicketMentionItem>>(
  function TicketList(props, ref) {
    const { selected, setSelected, select } = useSuggestionNav(props, ref);
    return (
      <SuggestionMenu
        className="w-72"
        items={props.items}
        label="Link a task"
        onHover={setSelected}
        onSelect={select}
        selected={selected}
      >
        {(item) => (
          <>
            <HashIcon aria-hidden="true" />
            <span className="shrink-0 font-mono text-muted-foreground text-xs">
              {item.label}
            </span>
            <span className="truncate">{item.title}</span>
          </>
        )}
      </SuggestionMenu>
    );
  },
);

// ── suggestion popup plumbing ────────────────────────────────────────────────

// mount inside the open dialog/drawer: base ui treats clicks outside its popup
// as outside-press and would dismiss it
function createPopup(editor: Editor) {
  const host =
    editor.view.dom.closest<HTMLElement>(
      '[role="dialog"], [role="alertdialog"]',
    ) ?? document.body;
  const popup = document.createElement("div");
  popup.style.position = "fixed";
  popup.style.zIndex = "60";
  popup.style.pointerEvents = "auto";
  host.appendChild(popup);

  const place = (clientRect?: (() => DOMRect | null) | null) => {
    const rect = clientRect?.();
    if (!rect) return;
    // transformed hosts re-base `fixed`; measure the real origin first
    popup.style.left = "0px";
    popup.style.top = "0px";
    const origin = popup.getBoundingClientRect();
    popup.style.left = `${rect.left - origin.left}px`;
    popup.style.top = `${rect.bottom + 6 - origin.top}px`;
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
      let component: ReactRenderer<
        SuggestionHandle,
        ListProps<MentionItem>
      > | null =
        null;
      let mount: ReturnType<typeof createPopup> | null = null;

      return {
        onStart: (props: SuggestionProps<MentionItem>) => {
          component = new ReactRenderer(MentionList, {
            editor: props.editor,
            props,
          });
          mount = createPopup(props.editor);
          mount.popup.appendChild(component.element);
          mount.place(props.clientRect);
        },
        onUpdate: (props: SuggestionProps<MentionItem>) => {
          component?.updateProps(props);
          mount?.place(props.clientRect);
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === "Escape") {
            // stop host esc handlers (dialogs, docs discard) from also firing
            props.event.preventDefault();
            props.event.stopPropagation();
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
      let component: ReactRenderer<
        SuggestionHandle,
        ListProps<TicketMentionItem>
      > | null =
        null;
      let mount: ReturnType<typeof createPopup> | null = null;

      return {
        onStart: (props: SuggestionProps<TicketMentionItem>) => {
          component = new ReactRenderer(TicketList, {
            editor: props.editor,
            props,
          });
          mount = createPopup(props.editor);
          mount.popup.appendChild(component.element);
          mount.place(props.clientRect);
        },
        onUpdate: (props: SuggestionProps<TicketMentionItem>) => {
          component?.updateProps(props);
          mount?.place(props.clientRect);
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === "Escape") {
            // stop host esc handlers (dialogs, docs discard) from also firing
            props.event.preventDefault();
            props.event.stopPropagation();
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
