"use client";

import { mergeAttributes } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { PluginKey } from "@tiptap/pm/state";
import {
  NodeViewWrapper,
  type NodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { FileTextIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  SuggestionMenu,
  suggestionPopup,
  type SuggestionListProps,
  useSuggestionNav,
} from "./suggestion";

/** A linkable doc page: label is the title at insert time; chips show the live title. */
export type PageMentionItem = {
  id: string;
  label: string;
  icon?: string | null;
  href: string;
  /** Breadcrumb-ish context in the picker, e.g. parent title. */
  sublabel?: string | null;
};

export const PAGE_TRIGGER = "[[";

const PAGE_CLASS =
  "cursor-pointer rounded-sm px-0.5 py-0.5 font-medium text-foreground underline decoration-border underline-offset-[3px] hover:bg-accent hover:decoration-foreground/40";

function PageGlyph({ icon }: { icon?: string | null }) {
  return icon ? (
    <span aria-hidden="true" className="me-1 not-italic">
      {icon}
    </span>
  ) : (
    <FileTextIcon
      aria-hidden="true"
      className="text-muted-foreground me-1 inline size-[1em] -translate-y-px"
    />
  );
}

function PageChip({
  node,
  getItems,
}: {
  node: ProseMirrorNode;
  getItems: () => PageMentionItem[];
}) {
  const router = useRouter();
  const id = (node.attrs.id as string | null) ?? null;
  const item = id ? getItems().find((i) => i.id === id) : undefined;
  // deleted target: keep the stored label, struck through
  const missing = getItems().length > 0 && !item;
  const label = item?.label ?? (node.attrs.label as string | null) ?? "Page";

  return (
    <NodeViewWrapper as="span" className="inline">
      <a
        className={PAGE_CLASS}
        data-id={id ?? undefined}
        data-type="page"
        href={item?.href}
        onClick={(e) => {
          if (!item || e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          router.push(item.href);
        }}
        title={missing ? "This page was deleted" : undefined}
      >
        <PageGlyph icon={item?.icon} />
        <span className={missing ? "line-through opacity-60" : undefined}>
          {label}
        </span>
      </a>
    </NodeViewWrapper>
  );
}

function PageList({
  items,
  command,
  ref,
}: SuggestionListProps<PageMentionItem>) {
  const nav = useSuggestionNav(
    items,
    (i) => command({ id: i.id, label: i.label }),
    ref,
  );
  return (
    <SuggestionMenu
      className="w-72"
      items={items}
      keyOf={(i) => i.id}
      label="Link to page"
      onHover={nav.setSelected}
      onSelect={nav.select}
      selected={nav.selected}
    >
      {(item) => (
        <>
          {item.icon ? (
            <span aria-hidden="true" className="w-4 shrink-0 text-center">
              {item.icon}
            </span>
          ) : (
            <FileTextIcon aria-hidden="true" />
          )}
          <span className="truncate">{item.label}</span>
          {item.sublabel ? (
            <span className="text-muted-foreground ms-auto max-w-[40%] shrink-0 truncate text-xs">
              {item.sublabel}
            </span>
          ) : null}
        </>
      )}
    </SuggestionMenu>
  );
}

function buildPageSuggestion(
  getItems: () => PageMentionItem[],
): Omit<SuggestionOptions<PageMentionItem>, "editor"> {
  return {
    char: PAGE_TRIGGER,
    pluginKey: new PluginKey("pageSuggestion"),
    // titles have spaces
    allowSpaces: true,
    items: ({ query }) => {
      const q = query.replace(/\]+$/, "").trim().toLowerCase();
      return getItems()
        .filter((i) => i.label.toLowerCase().includes(q))
        .slice(0, 8);
    },
    render: suggestionPopup(PageList),
  };
}

const PageMention = Mention.extend({
  name: "page",
  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        { "data-type": "page" },
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

function pageMention(getItems: () => PageMentionItem[]) {
  return PageMention.extend({
    addNodeView() {
      return ReactNodeViewRenderer((props: NodeViewProps) => (
        <PageChip getItems={getItems} node={props.node} />
      ));
    },
  });
}

/** `[[` page links with a title autocomplete backed by `getItems`. */
export function createPageMentionExtension(getItems: () => PageMentionItem[]) {
  return pageMention(getItems).configure({
    suggestion: buildPageSuggestion(getItems),
  });
}

/** Render-only page link for read-only content. */
export function createPageRenderExtension(getItems: () => PageMentionItem[]) {
  return pageMention(getItems).configure({});
}
