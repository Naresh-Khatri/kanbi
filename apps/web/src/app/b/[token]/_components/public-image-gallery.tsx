"use client";

import { ImageOffIcon, PaperclipIcon } from "lucide-react";
import { useState } from "react";

import { ImageLightbox } from "@/components/image-lightbox";
import { cn } from "@/lib/utils";
import type { PublicImage } from "./public-types";

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

      <ImageLightbox images={images} index={index} onIndexChange={setIndex} />
    </section>
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
