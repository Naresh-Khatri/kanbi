"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { ColorSwatchGroup } from "@/components/color-swatch-group";
import { Button } from "@/components/ui/button";
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AVATAR_BG_COLORS, buildAvatarUrl } from "@/lib/avatar";

const PAGE_SIZE = 10;

const BG_OPTIONS = AVATAR_BG_COLORS.map((c) => ({
  value: c,
  label: `#${c}`,
  color: `#${c}`,
}));

export function AvatarPicker({
  seed,
  bg,
  onSeedChange,
  onBgChange,
}: {
  seed: string;
  bg: string;
  onSeedChange: (seed: string) => void;
  onBgChange: (bg: string) => void;
}) {
  const [page, setPage] = useState(() => {
    const n = Number(seed);
    return Number.isInteger(n) && n >= 0 ? Math.floor(n / PAGE_SIZE) : 0;
  });

  const options = useMemo(
    () =>
      Array.from({ length: PAGE_SIZE }, (_, i) => String(page * PAGE_SIZE + i)),
    [page],
  );

  return (
    <div className="flex flex-col gap-4">
      <Fieldset className="flex flex-col gap-2">
        <div className="flex w-full items-center justify-between gap-2">
          <FieldsetLegend className="text-sm font-medium">
            Avatar
          </FieldsetLegend>
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <Button
              aria-label="Previous avatars"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <span className="tabular-nums">Page {page + 1}</span>
            <Button
              aria-label="More avatars"
              onClick={() => setPage((p) => p + 1)}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
        <ToggleGroup
          aria-label="Avatar"
          className="grid w-full grid-cols-5 gap-2"
          onValueChange={(next) => {
            const v = next[0] as string | undefined;
            if (v) onSeedChange(v);
          }}
          value={[seed]}
          variant="outline"
        >
          {options.map((s) => (
            <ToggleGroupItem
              aria-label={`Avatar ${Number(s) + 1}`}
              className="data-pressed:ring-foreground/70 data-pressed:ring-offset-background aspect-square size-auto h-auto overflow-hidden rounded-xl p-0 data-pressed:ring-2 data-pressed:ring-offset-2 sm:h-auto"
              key={s}
              value={s}
            >
              <img alt="" className="size-full" src={buildAvatarUrl(s, bg)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Fieldset>

      <Fieldset className="flex flex-col gap-2">
        <FieldsetLegend className="text-sm font-medium">
          Background
        </FieldsetLegend>
        <ColorSwatchGroup
          aria-label="Avatar background"
          onValueChange={onBgChange}
          options={BG_OPTIONS}
          value={bg}
        />
      </Fieldset>
    </div>
  );
}
