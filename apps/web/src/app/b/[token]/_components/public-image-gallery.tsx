"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageOffIcon,
  PaperclipIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PublicImage } from "./public-types";

const SWIPE_PX = 48;

export function PublicImageGallery({
  images,
  hiddenFiles,
}: {
  images: PublicImage[];
  hiddenFiles: number;
}) {
  const [index, setIndex] = useState<number | null>(null);
  if (images.length === 0 && hiddenFiles === 0) return null;

  return (
    <section className="flex flex-col gap-2 border-t pt-4">
      {images.length > 0 ? (
        <>
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium">Images</span>
            <span className="text-muted-foreground tabular-nums">
              {images.length}
            </span>
          </div>
          <ul className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <li key={img.id}>
                <button
                  aria-label={`Open ${img.filename}`}
                  className="group bg-muted hover:border-input focus-visible:ring-ring focus-visible:ring-offset-background block aspect-square w-full cursor-pointer touch-manipulation overflow-hidden rounded-lg border transition-[scale,border-color] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:scale-[0.97] motion-reduce:active:scale-100"
                  onClick={() => setIndex(i)}
                  type="button"
                >
                  <SignedImage
                    className="size-full object-cover transition-opacity group-hover:opacity-88"
                    image={img}
                  />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {hiddenFiles > 0 ? (
        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
          <PaperclipIcon aria-hidden="true" className="size-3" />+ {hiddenFiles}{" "}
          {hiddenFiles === 1 ? "file" : "files"} (not shared)
        </p>
      ) : null}

      <Lightbox images={images} index={index} onIndexChange={setIndex} />
    </section>
  );
}

function Lightbox({
  images,
  index,
  onIndexChange,
}: {
  images: PublicImage[];
  index: number | null;
  onIndexChange: (i: number | null) => void;
}) {
  const touchX = useRef<number | null>(null);
  const current = index != null ? images[index] : undefined;
  const many = images.length > 1;

  function step(delta: number) {
    if (index == null) return;
    onIndexChange((index + delta + images.length) % images.length);
  }

  return (
    <Dialog
      onOpenChange={(open) => !open && onIndexChange(null)}
      open={current != null}
    >
      <DialogPopup
        bottomStickOnMobile={false}
        className="max-w-[min(64rem,calc(100vw-2rem))] overflow-hidden"
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowRight") step(1);
          else if (e.key === "ArrowLeft") step(-1);
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (!many || start == null || end == null) return;
          if (Math.abs(end - start) > SWIPE_PX) step(end < start ? 1 : -1);
        }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
      >
        {current ? (
          <>
            <div className="bg-muted/40 flex min-h-48 items-center justify-center p-2 pt-12">
              <SignedImage
                className="max-h-[75dvh] w-auto max-w-full rounded-md object-contain"
                image={current}
                key={current.id}
              />
            </div>
            <div className="flex items-center gap-3 border-t px-4 py-3">
              <DialogTitle className="min-w-0 flex-1 truncate text-sm font-normal">
                {current.filename}
              </DialogTitle>
              {many ? (
                <>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {(index ?? 0) + 1} / {images.length}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      aria-label="Previous image"
                      onClick={() => step(-1)}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronLeftIcon aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label="Next image"
                      onClick={() => step(1)}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronRightIcon aria-hidden="true" />
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}

// signed urls expire (~1h) -> say "reload" instead of a broken-image glyph
function SignedImage({
  image,
  className,
}: {
  image: PublicImage;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="text-muted-foreground flex size-full min-h-24 flex-col items-center justify-center gap-1 p-2 text-center text-xs">
        <ImageOffIcon aria-hidden="true" className="size-4" />
        Reload to view
      </span>
    );
  }
  return (
    <img
      alt={image.filename}
      className={cn("bg-muted", className)}
      decoding="async"
      loading="lazy"
      onError={() => setFailed(true)}
      src={image.url}
    />
  );
}
