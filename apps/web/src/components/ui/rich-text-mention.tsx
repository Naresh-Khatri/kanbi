"use client";

import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
  SuggestionProps,
} from "@tiptap/suggestion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

export type MentionItem = { id: string; label: string; image: string | null };

/** Tailwind class applied to a rendered mention chip (editor + read-only). */
const MENTION_CLASS =
  "rounded bg-blue-500/15 px-1 py-0.5 font-medium text-blue-300";

type MentionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

type MentionListProps = {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
};

const MentionList = forwardRef<MentionListHandle, MentionListProps>(
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
      let component: ReactRenderer<MentionListHandle, MentionListProps> | null =
        null;
      let popup: HTMLDivElement | null = null;

      const place = (clientRect?: (() => DOMRect | null) | null) => {
        if (!popup || !clientRect) return;
        const rect = clientRect();
        if (!rect) return;
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 6}px`;
      };

      return {
        onStart: (props: SuggestionProps<MentionItem>) => {
          component = new ReactRenderer(MentionList, {
            editor: props.editor,
            props,
          });
          popup = document.createElement("div");
          popup.style.position = "fixed";
          popup.style.zIndex = "200";
          // Re-enable pointer events: a modal Radix dialog sets the body to
          // pointer-events:none, which would otherwise swallow clicks here.
          popup.style.pointerEvents = "auto";
          popup.appendChild(component.element);
          document.body.appendChild(popup);
          place(props.clientRect);
        },
        onUpdate: (props: SuggestionProps<MentionItem>) => {
          component?.updateProps(props);
          place(props.clientRect);
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === "Escape") {
            popup?.remove();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          popup?.remove();
          popup = null;
          component?.destroy();
          component = null;
        },
      };
    },
  };
}

/** Mention extension with an @-autocomplete dropdown backed by `getItems`. */
export function createMentionExtension(getItems: () => MentionItem[]) {
  return Mention.configure({
    HTMLAttributes: { class: MENTION_CLASS },
    suggestion: buildSuggestion(getItems),
  });
}

/** Render-only mention node (no autocomplete) for read-only content. */
export const mentionRenderExtension = Mention.configure({
  HTMLAttributes: { class: MENTION_CLASS },
});
