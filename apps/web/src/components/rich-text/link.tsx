"use client";

import Link from "@tiptap/extension-link";
import {
  MarkViewContent,
  type MarkViewProps,
  ReactMarkViewRenderer,
} from "@tiptap/react";
import * as React from "react";
import { HoverCard, LinkCard, TaskCard } from "./hover-card";
import type { TicketMentionItem } from "./mention";

const projectOf = (path: string) => /^\/app\/p\/[^/]+/.exec(path)?.[0];

// task urls: /app/p/<slug>?task=<number|KEY-n|id>
function findLinkedTicket(href: string, tickets: TicketMentionItem[]) {
  let url: URL;
  try {
    url = new URL(href, location.origin);
  } catch {
    return undefined;
  }
  if (url.origin !== location.origin) return undefined;
  const param = url.searchParams.get("task");
  if (!param) return undefined;
  const byId = tickets.find((t) => t.id === param);
  if (byId) return byId;
  // bare numbers only resolve against the project we're in
  const n = /^(?:[A-Za-z0-9]+-)?(\d+)$/.exec(param)?.[1];
  if (!n || projectOf(url.pathname) !== projectOf(location.pathname))
    return undefined;
  return tickets.find((t) => t.label.endsWith(`-${n}`));
}

/** Link mark with a hover card: page preview, or the task card for links to a known task. */
export function createLinkExtension(opts: {
  openOnClick: boolean;
  getTickets: () => TicketMentionItem[];
}) {
  return Link.extend({
    addMarkView() {
      return ReactMarkViewRenderer((props: MarkViewProps) => (
        <LinkView {...props} getTickets={opts.getTickets} />
      ));
    },
  }).configure({ openOnClick: opts.openOnClick, autolink: true });
}

function LinkView({
  mark,
  editor,
  HTMLAttributes,
  getTickets,
}: MarkViewProps & { getTickets: () => TicketMentionItem[] }) {
  const href = String(mark.attrs.href ?? "");
  const anchor = React.useRef<HTMLAnchorElement>(null);
  const { class: className, ...attrs } = HTMLAttributes as Record<
    string,
    string
  >;

  const remove = () => {
    const el = anchor.current;
    if (!el) return;
    editor
      .chain()
      .focus()
      .setTextSelection(editor.view.posAtDOM(el, 0))
      .extendMarkRange("link")
      .unsetLink()
      .run();
  };

  return (
    <HoverCard
      content={
        <LinkContent
          getTickets={getTickets}
          href={href}
          onRemove={editor.isEditable ? remove : undefined}
        />
      }
      trigger={<a {...attrs} className={className} ref={anchor} />}
    >
      <MarkViewContent />
    </HoverCard>
  );
}

// resolved on open so late-loading tickets still match
function LinkContent({
  href,
  getTickets,
  onRemove,
}: {
  href: string;
  getTickets: () => TicketMentionItem[];
  onRemove?: () => void;
}) {
  const task = findLinkedTicket(href, getTickets());
  if (task) return <TaskCard item={task} />;
  return <LinkCard href={href} onRemove={onRemove} />;
}
