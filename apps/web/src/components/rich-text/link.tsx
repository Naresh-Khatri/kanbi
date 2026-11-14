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

// task urls are /app/p/<slug>?task=<id>
const taskIdOf = (href: string) => {
  try {
    const url = new URL(href, location.origin);
    return url.origin === location.origin ? url.searchParams.get("task") : null;
  } catch {
    return null;
  }
};

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
  const taskId = taskIdOf(href);
  const task = taskId ? getTickets().find((t) => t.id === taskId) : undefined;
  if (task) return <TaskCard item={task} />;
  return <LinkCard href={href} onRemove={onRemove} />;
}
