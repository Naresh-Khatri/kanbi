"use client";

import {
  MoveUpRightIcon,
  PencilIcon,
  SquareIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type Tool = "pen" | "arrow" | "box";
type Point = { x: number; y: number };
export type Shape = {
  tool: Tool;
  color: string;
  width: number;
  points: Point[];
};

const COLORS = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#111827",
  "#ffffff",
];

function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  const [a, ...rest] = s.points;
  if (!a) return;
  const b = rest.at(-1) ?? a;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (s.tool === "pen") {
    ctx.moveTo(a.x, a.y);
    // single click still leaves a dot
    if (rest.length === 0) ctx.lineTo(a.x + 0.01, a.y);
    for (const p of rest) ctx.lineTo(p.x, p.y);
  } else if (s.tool === "box") {
    ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const head = s.width * 4;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    for (const side of [-1, 1]) {
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(
        b.x - head * Math.cos(angle + (side * Math.PI) / 6),
        b.y - head * Math.sin(angle + (side * Math.PI) / 6),
      );
    }
  }
  ctx.stroke();
}

/** Draw pen/arrow/box marks over an image; resolves a flattened png. */
export function ImageAnnotator({
  open,
  onOpenChange,
  src,
  initialShapes,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  initialShapes?: Shape[];
  onSave: (blob: Blob, shapes: Shape[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]!);

  useEffect(() => {
    if (!open || !src) return;
    setShapes(initialShapes ?? []);
    setImg(null);
    const el = new Image();
    el.onload = () => setImg(el);
    el.src = src;
    // initialShapes read once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, src]);

  // canvas mounts with the portal, so redraw once both exist
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    if (canvas.width !== img.naturalWidth) canvas.width = img.naturalWidth;
    if (canvas.height !== img.naturalHeight) canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    for (const s of shapes) drawShape(ctx, s);
    if (draft) drawShape(ctx, draft);
  });

  function toImage(e: PointerEvent<HTMLCanvasElement>): Point {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * e.currentTarget.width,
      y: ((e.clientY - r.top) / r.height) * e.currentTarget.height,
    };
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!img || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const width = Math.max(
      3,
      Math.max(img.naturalWidth, img.naturalHeight) / 200,
    );
    setDraft({ tool, color, width, points: [toImage(e)] });
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!draft) return;
    const p = toImage(e);
    setDraft({
      ...draft,
      points:
        draft.tool === "pen" ? [...draft.points, p] : [draft.points[0]!, p],
    });
  }

  function onPointerUp() {
    if (!draft) return;
    setShapes((prev) => [...prev, draft]);
    setDraft(null);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      onSave(blob, shapes);
      onOpenChange(false);
    }, "image/png");
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup
        className="max-w-4xl"
        // keep mod+enter / paste from reaching a parent form (portals bubble in react)
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            setShapes((prev) => prev.slice(0, -1));
          }
        }}
        onPaste={(e) => e.stopPropagation()}
      >
        <DialogHeader className="pb-3">
          <DialogTitle className="text-base">Mark up image</DialogTitle>
          <DialogDescription className="sr-only">
            Draw on the image to point things out
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6">
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              onValueChange={(v) => {
                const next = v[0] as Tool | undefined;
                if (next) setTool(next);
              }}
              size="sm"
              value={[tool]}
              variant="outline"
            >
              <ToggleGroupItem aria-label="Pen" value="pen">
                <PencilIcon />
              </ToggleGroupItem>
              <ToggleGroupItem aria-label="Arrow" value="arrow">
                <MoveUpRightIcon />
              </ToggleGroupItem>
              <ToggleGroupItem aria-label="Box" value="box">
                <SquareIcon />
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className={cn(
                    "ring-offset-background focus-visible:ring-ring size-6 rounded-full border border-black/16 ring-offset-2 outline-none focus-visible:ring-2 dark:border-white/24",
                    color === c && "ring-foreground ring-2",
                  )}
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  type="button"
                />
              ))}
            </div>
            <div className="ms-auto flex items-center gap-1">
              <Button
                disabled={shapes.length === 0}
                onClick={() => setShapes((prev) => prev.slice(0, -1))}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Undo2Icon aria-hidden="true" />
                Undo
              </Button>
              <Button
                disabled={shapes.length === 0}
                onClick={() => setShapes([])}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2Icon aria-hidden="true" />
                Clear
              </Button>
            </div>
          </div>
          <div className="bg-muted flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg">
            <canvas
              className={cn(
                "max-h-[65vh] max-w-full cursor-crosshair touch-none",
                !img && "invisible",
              )}
              onPointerCancel={onPointerUp}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              ref={canvasRef}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="ghost" />}>
            Cancel
          </DialogClose>
          <Button disabled={!img} onClick={save} type="button">
            Save
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
