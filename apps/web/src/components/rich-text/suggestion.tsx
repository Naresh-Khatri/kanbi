"use client";

import type { Editor } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
  SuggestionProps,
} from "@tiptap/suggestion";
import * as React from "react";
import { cn } from "@/lib/utils";

export type SuggestionHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

export type SuggestionListProps<I> = SuggestionProps<I> & {
  ref?: React.Ref<SuggestionHandle>;
};

/** Arrow/enter/tab navigation over `items`, exposed to the suggestion plugin via `ref`. */
export function useSuggestionNav<I>(
  items: I[],
  onSelect: (item: I) => void,
  ref: React.Ref<SuggestionHandle> | undefined,
) {
  const [selected, setSelected] = React.useState(0);
  React.useEffect(() => setSelected(0), [items]);

  const select = (index: number) => {
    const item = items[index];
    if (item) onSelect(item);
  };

  React.useImperativeHandle(ref, () => ({
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

/** Listbox styled as a coss menu popup; `groupOf` adds section headings. */
export function SuggestionMenu<I>({
  items,
  selected,
  onHover,
  onSelect,
  label,
  keyOf,
  groupOf,
  className,
  children,
}: {
  items: I[];
  selected: number;
  onHover: (i: number) => void;
  onSelect: (i: number) => void;
  label: string;
  keyOf: (item: I) => string;
  groupOf?: (item: I) => string;
  className?: string;
  children: (item: I) => React.ReactNode;
}) {
  const list = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (items.length === 0) return null;
  return (
    <div
      aria-label={label}
      className={cn(
        "bg-popover text-popover-foreground relative max-h-72 min-w-48 overflow-y-auto rounded-lg border p-1 shadow-lg/5 not-dark:bg-clip-padding",
        className,
      )}
      ref={list}
      role="listbox"
    >
      {items.map((item, i) => {
        const group = groupOf?.(item);
        const heading =
          group && (i === 0 || groupOf?.(items[i - 1]!) !== group);
        return (
          <React.Fragment key={keyOf(item)}>
            {heading ? (
              <div className="text-muted-foreground px-2 pt-1.5 pb-1 text-xs font-medium first:pt-1">
                {group}
              </div>
            ) : null}
            <div
              aria-selected={i === selected}
              className="text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground flex min-h-8 cursor-default items-center gap-2 rounded-sm px-2 py-1 text-base select-none sm:min-h-7 sm:text-sm [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:opacity-80"
              onClick={() => onSelect(i)}
              // keep focus in the editor
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => onHover(i)}
              role="option"
              tabIndex={-1}
            >
              {children(item)}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

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

/** Suggestion `render` that mounts `List` in a caret-anchored popup. */
export function suggestionPopup<I>(
  List: React.ComponentType<SuggestionListProps<I>>,
): SuggestionOptions<I>["render"] {
  return () => {
    let component: ReactRenderer<
      SuggestionHandle,
      SuggestionListProps<I>
    > | null = null;
    let mount: ReturnType<typeof createPopup> | null = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(List, { editor: props.editor, props });
        mount = createPopup(props.editor);
        mount.popup.appendChild(component.element);
        mount.place(props.clientRect);
      },
      onUpdate: (props) => {
        component?.updateProps(props);
        mount?.place(props.clientRect);
      },
      onKeyDown: (props) => {
        if (props.event.key === "Escape") {
          // plugin exits itself; stop host esc handlers (dialogs, docs discard) too
          props.event.preventDefault();
          props.event.stopPropagation();
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
  };
}
