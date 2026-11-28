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
        "bg-popover text-popover-foreground relative max-h-[min(--spacing(72),var(--suggestion-max-h,--spacing(72)))] min-w-48 overflow-y-auto rounded-lg border p-1 shadow-lg/5 not-dark:bg-clip-padding",
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

const GAP = 6;
const PAD = 8;
const MAX_H = 288; // max-h-72

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

  let last: (() => DOMRect | null) | null | undefined;
  const place = (clientRect?: (() => DOMRect | null) | null) => {
    if (clientRect !== undefined) last = clientRect;
    const rect = last?.();
    if (!rect) return;
    // transformed hosts re-base `fixed`; measure the real origin first
    popup.style.left = "0px";
    popup.style.top = "0px";
    const origin = popup.getBoundingClientRect();

    const vv = window.visualViewport;
    const viewTop = vv?.offsetTop ?? 0;
    const viewBottom = viewTop + (vv?.height ?? window.innerHeight);
    const viewLeft = vv?.offsetLeft ?? 0;
    const viewRight = viewLeft + (vv?.width ?? window.innerWidth);
    const below = viewBottom - rect.bottom - GAP - PAD;
    const above = rect.top - viewTop - GAP - PAD;

    const { width } = popup.getBoundingClientRect();
    const list = popup.querySelector<HTMLElement>('[role="listbox"]');
    // uncapped height from scrollHeight; dropping the cap would reset list scroll
    const height = list
      ? Math.min(
          list.scrollHeight + list.offsetHeight - list.clientHeight,
          MAX_H,
        )
      : 0;
    const flip = height > below && above > below;
    const room = Math.max(flip ? above : below, 0);
    popup.style.setProperty("--suggestion-max-h", `${room}px`);
    const h = Math.min(height, room);

    const top = flip ? rect.top - GAP - h : rect.bottom + GAP;
    const left = Math.max(
      viewLeft + PAD,
      Math.min(rect.left, viewRight - width - PAD),
    );
    popup.style.left = `${left - origin.left}px`;
    popup.style.top = `${top - origin.top}px`;
  };

  // list size changes after render/filtering -> re-place
  const resize = new ResizeObserver(() => place());
  resize.observe(popup);
  const onViewport = (e: Event) => {
    if (e.target instanceof Node && popup.contains(e.target)) return;
    place();
  };
  window.visualViewport?.addEventListener("resize", onViewport);
  window.addEventListener("resize", onViewport);
  // caret moves with any scrolling ancestor
  window.addEventListener("scroll", onViewport, true);
  const destroy = () => {
    resize.disconnect();
    window.visualViewport?.removeEventListener("resize", onViewport);
    window.removeEventListener("resize", onViewport);
    window.removeEventListener("scroll", onViewport, true);
    popup.remove();
  };

  return { popup, place, destroy };
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
        mount?.destroy();
        mount = null;
        component?.destroy();
        component = null;
      },
    };
  };
}
