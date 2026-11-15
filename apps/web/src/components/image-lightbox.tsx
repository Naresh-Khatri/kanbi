"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  ImageOffIcon,
  MinusIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as RKeyboardEvent,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type LightboxImage = { id: string; url: string; filename: string };

const FIT = 0.9;
const MAX_SCALE = 6;
const CLICK_SCALE = 2.5;
const SWIPE_PX = 64;
const DISMISS_PX = 120;
const TAP_SLOP = 6;

type View = { s: number; x: number; y: number };
const RESET: View = { s: 1, x: 0, y: 0 };

export function ImageLightbox({
  images,
  index,
  onIndexChange,
}: {
  images: LightboxImage[];
  index: number | null;
  onIndexChange: (i: number | null) => void;
}) {
  const open = index != null && images[index] != null;
  // keep last frame mounted so close animation isn't an empty fade
  const last = useRef<{ images: LightboxImage[]; index: number } | null>(null);
  if (open) last.current = { images, index };
  const shown = last.current;

  return (
    <DialogPrimitive.Root
      onOpenChange={(o) => !o && onIndexChange(null)}
      open={open}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/88 backdrop-blur-md transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 text-white transition-[opacity,scale] duration-200 ease-out outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none">
          {shown ? (
            <Viewer
              images={shown.images}
              index={shown.index}
              onClose={() => onIndexChange(null)}
              onIndexChange={onIndexChange}
            />
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Viewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const current = images[index]!;
  const many = images.length > 1;
  const stageRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<View>(RESET);
  const [animate, setAnimate] = useState(true);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [natural, setNatural] = useState<Record<string, [number, number]>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [stage, setStage] = useState<[number, number]>([0, 0]);

  const viewRef = useRef(view);
  viewRef.current = view;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage([el.clientWidth, el.clientHeight]);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // contain-fit to 90% of the limiting axis; small images upscale too
  const nat = natural[current.id];
  const fit = (() => {
    if (!nat || !stage[0]) return null;
    const k = Math.min((stage[0] * FIT) / nat[0], (stage[1] * FIT) / nat[1]);
    return { w: nat[0] * k, h: nat[1] * k };
  })();
  const fitRef = useRef(fit);
  fitRef.current = fit;

  const clamp = useCallback(
    (v: View): View => {
      const s = Math.min(MAX_SCALE, Math.max(1, v.s));
      const f = fitRef.current;
      if (!f || s === 1) return { s, x: 0, y: 0 };
      const mx = Math.max(0, (f.w * s - stage[0]) / 2);
      const my = Math.max(0, (f.h * s - stage[1]) / 2);
      return {
        s,
        x: Math.min(mx, Math.max(-mx, v.x)),
        y: Math.min(my, Math.max(-my, v.y)),
      };
    },
    [stage],
  );

  /** zoom to `next` keeping the point under (cx,cy) — relative to stage center — fixed */
  const zoomAt = useCallback(
    (next: number, cx = 0, cy = 0, smooth = true) => {
      const v = viewRef.current;
      const s = Math.min(MAX_SCALE, Math.max(1, next));
      setAnimate(smooth);
      setView(
        clamp({
          s,
          x: cx - ((cx - v.x) * s) / v.s,
          y: cy - ((cy - v.y) * s) / v.s,
        }),
      );
    },
    [clamp],
  );

  const go = useCallback(
    (i: number) => {
      setAnimate(false);
      setView(RESET);
      onIndexChange((i + images.length) % images.length);
    },
    [images.length, onIndexChange],
  );

  const toStage = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return [
      clientX - r.left - r.width / 2,
      clientY - r.top - r.height / 2,
    ] as const;
  };

  // react's wheel listener is passive -> can't preventDefault page zoom
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      zoomAt(
        viewRef.current.s * k,
        e.clientX - r.left - r.width / 2,
        e.clientY - r.top - r.height / 2,
        false,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    for (const d of [-1, 1]) {
      const n = images[(index + d + images.length) % images.length];
      if (n && n.id !== current.id) new Image().src = n.url;
    }
  }, [images, index, current.id]);

  // gestures: 1 pointer = pan (zoomed) / swipe-nav + swipe-down-close (fit); 2 = pinch
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    start: { x: number; y: number };
    view: View;
    pinch?: { dist: number; mid: readonly [number, number] };
    axis?: "x" | "y";
    moved: boolean;
    onImage: boolean;
    type: string;
  } | null>(null);
  const lastTap = useRef(0);

  const pinchInfo = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return null;
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: toStage((a.x + b.x) / 2, (a.y + b.y) / 2),
    };
  };

  function onPointerDown(e: RPointerEvent) {
    if (e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    const pinch = pointers.current.size === 2 ? pinchInfo() : null;
    gesture.current = {
      start: { x: e.clientX, y: e.clientY },
      view: viewRef.current,
      pinch: pinch ?? undefined,
      moved: gesture.current?.moved ?? false,
      // read now: after capture, pointerup targets the stage
      onImage:
        (e.target as HTMLElement).dataset.lightboxImage != null &&
        pointers.current.size === 1,
      type: e.pointerType,
    };
    if (pinch) gesture.current.moved = true;
  }

  function onPointerMove(e: RPointerEvent) {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (g.pinch) {
      const p = pinchInfo();
      if (!p) return;
      const s = Math.min(
        MAX_SCALE,
        Math.max(1, (g.view.s * p.dist) / g.pinch.dist),
      );
      const [mx, my] = g.pinch.mid;
      setAnimate(false);
      setView(
        clamp({
          s,
          x: p.mid[0] - ((mx - g.view.x) * s) / g.view.s,
          y: p.mid[1] - ((my - g.view.y) * s) / g.view.s,
        }),
      );
      return;
    }

    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    g.moved = true;

    if (g.view.s > 1) {
      setAnimate(false);
      setView(clamp({ ...g.view, x: g.view.x + dx, y: g.view.y + dy }));
      return;
    }
    g.axis ??= Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (g.axis === "x" && !many) return;
    // only follow downward for dismiss
    setDrag(g.axis === "x" ? { x: dx, y: 0 } : { x: 0, y: Math.max(0, dy) });
  }

  function onPointerUp(e: RPointerEvent) {
    const g = gesture.current;
    if (!pointers.current.delete(e.pointerId) || !g) return;

    if (pointers.current.size > 0) {
      // pinch -> one finger left: restart as pan from here
      const [rest] = [...pointers.current.values()];
      gesture.current = {
        ...g,
        start: rest!,
        view: viewRef.current,
        pinch: undefined,
      };
      return;
    }
    gesture.current = null;
    setAnimate(true);

    if (drag) {
      setDrag(null);
      if (g.axis === "x" && Math.abs(drag.x) > SWIPE_PX)
        go(index + (drag.x < 0 ? 1 : -1));
      else if (g.axis === "y" && drag.y > DISMISS_PX) onClose();
      return;
    }
    if (g.moved || e.type === "pointercancel") return;

    if (!g.onImage) {
      if (viewRef.current.s === 1) onClose();
      else zoomAt(1);
      return;
    }
    // mouse: single click toggles; touch: double-tap toggles
    if (g.type === "touch") {
      const now = e.timeStamp;
      if (now - lastTap.current > 300) {
        lastTap.current = now;
        return;
      }
      lastTap.current = 0;
    }
    const [cx, cy] = toStage(e.clientX, e.clientY);
    if (viewRef.current.s > 1) zoomAt(1);
    else zoomAt(CLICK_SCALE, cx, cy);
  }

  function onKeyDown(e: RKeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "ArrowRight" && many) go(index + 1);
    else if (k === "ArrowLeft" && many) go(index - 1);
    else if (k === "+" || k === "=") zoomAt(view.s * 1.5);
    else if (k === "-" || k === "_") zoomAt(view.s / 1.5);
    else if (k === "0") zoomAt(1);
    else return;
    e.preventDefault();
  }

  const zoomed = view.s > 1;
  const dismissProgress = drag ? Math.min(1, drag.y / (DISMISS_PX * 2)) : 0;
  const tx = view.x + (drag?.x ?? 0);
  const ty = view.y + (drag?.y ?? 0);
  const isFailed = failed[current.id];
  const loading = !nat && !isFailed;

  return (
    <div className="absolute inset-0 select-none" onKeyDown={onKeyDown}>
      <div
        className={cn(
          "absolute inset-0 flex touch-none items-center justify-center overflow-hidden",
          zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-out",
        )}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={stageRef}
        style={{ opacity: 1 - dismissProgress * 0.6 }}
      >
        {loading ? <Spinner className="absolute size-6 text-white/60" /> : null}
        {isFailed ? (
          <div className="flex flex-col items-center gap-2 text-center text-sm text-white/70">
            <ImageOffIcon aria-hidden="true" className="size-6" />
            <p>Couldn&rsquo;t load this image.</p>
            <p className="text-xs text-white/50">
              Reload the page to try again.
            </p>
          </div>
        ) : (
          <img
            alt={current.filename}
            className={cn(
              "max-w-none rounded-sm shadow-[0_24px_80px_-12px_rgb(0_0_0/0.7)] will-change-transform",
              !zoomed && "cursor-zoom-in",
              animate &&
                !drag &&
                "transition-[transform,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              fit ? "opacity-100" : "opacity-0",
            )}
            data-lightbox-image=""
            decoding="async"
            draggable={false}
            key={current.id}
            onError={() => setFailed((f) => ({ ...f, [current.id]: true }))}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              setNatural((n) => ({ ...n, [current.id]: [w, h] }));
            }}
            src={current.url}
            style={{
              width: fit?.w,
              height: fit?.h,
              transform: `translate3d(${tx}px, ${ty}px, 0) scale(${view.s * (1 - dismissProgress * 0.15)})`,
            }}
          />
        )}
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 bg-gradient-to-b from-black/60 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-10 transition-opacity duration-200 sm:px-5",
          drag && "opacity-0",
        )}
      >
        <div className="min-w-0 flex-1 pt-2.5">
          <DialogPrimitive.Title className="truncate text-sm font-medium text-white/90">
            {current.filename}
          </DialogPrimitive.Title>
          {many ? (
            <p className="text-xs text-white/50 tabular-nums">
              {index + 1} of {images.length}
            </p>
          ) : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/8 p-1 ring-1 ring-white/10 backdrop-blur-xl">
          <div className="hidden items-center sm:flex">
            <ToolButton
              disabled={view.s <= 1}
              label="Zoom out"
              onClick={() => zoomAt(view.s / 1.5)}
            >
              <MinusIcon />
            </ToolButton>
            <button
              aria-label="Reset zoom"
              className="h-10 min-w-14 cursor-pointer rounded-full px-2 text-xs font-medium text-white/70 tabular-nums transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
              onClick={() => zoomAt(1)}
              type="button"
            >
              {Math.round(view.s * 100)}%
            </button>
            <ToolButton
              disabled={view.s >= MAX_SCALE}
              label="Zoom in"
              onClick={() => zoomAt(view.s * 1.5)}
            >
              <PlusIcon />
            </ToolButton>
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
          </div>
          <a
            aria-label="Open original in new tab"
            className="flex size-10 items-center justify-center rounded-full text-white/70 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 [&_svg]:size-4"
            href={current.url}
            rel="noopener noreferrer"
            target="_blank"
            title="Open original"
          >
            <ExternalLinkIcon aria-hidden="true" />
          </a>
          <DialogPrimitive.Close
            aria-label="Close"
            className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60 [&_svg]:size-5"
            title="Close (Esc)"
          >
            <XIcon aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
      </div>

      {many ? (
        <>
          <NavButton
            className="start-2 sm:start-5"
            hidden={zoomed || !!drag}
            label="Previous image"
            onClick={() => go(index - 1)}
          >
            <ChevronLeftIcon />
          </NavButton>
          <NavButton
            className="end-2 sm:end-5"
            hidden={zoomed || !!drag}
            label="Next image"
            onClick={() => go(index + 1)}
          >
            <ChevronRightIcon />
          </NavButton>
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/60 to-transparent px-3 pt-10 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[opacity,translate] duration-200 ease-out",
              (zoomed || drag) && "pointer-events-none translate-y-2 opacity-0",
            )}
          >
            <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-xl bg-white/8 p-1.5 ring-1 ring-white/10 backdrop-blur-xl [scrollbar-width:none]">
              {images.map((img, i) => (
                <button
                  aria-current={i === index}
                  aria-label={`Show ${img.filename}`}
                  className={cn(
                    "size-11 shrink-0 cursor-pointer overflow-hidden rounded-md transition-[opacity,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                    i === index
                      ? "opacity-100 ring-2 ring-white"
                      : "opacity-45 hover:opacity-90",
                  )}
                  key={img.id}
                  onClick={() => go(i)}
                  type="button"
                >
                  <img
                    alt=""
                    className="size-full object-cover"
                    draggable={false}
                    loading="lazy"
                    src={img.url}
                  />
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className="flex size-10 cursor-pointer items-center justify-center rounded-full text-white/70 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function NavButton({
  label,
  onClick,
  hidden,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  hidden: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "absolute top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/8 text-white/80 ring-1 ring-white/10 backdrop-blur-xl transition-[opacity,background-color,scale] duration-150 outline-none hover:bg-white/16 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 active:scale-95 sm:size-12 [&_svg]:size-5",
        hidden && "pointer-events-none opacity-0",
        className,
      )}
      onClick={onClick}
      tabIndex={hidden ? -1 : undefined}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
