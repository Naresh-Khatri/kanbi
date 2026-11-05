"use client";

import { Swatch } from "@/components/ui/swatch";
import { Ban, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import { PageTitle } from "@/components/ui/surface";

const DICEBEAR_BASE = "https://api.dicebear.com/9.x/lorelei/svg";

const BG_COLORS = [
  "transparent",
  "b6e3f4",
  "c0aede",
  "d1d4f9",
  "ffd5dc",
  "ffdfbf",
  "a7f3d0",
  "fde68a",
  "fca5a5",
];

function buildAvatarUrl(seed: string, bg: string) {
  const params = new URLSearchParams({ seed: seed || "Kanbi" });
  if (bg && bg !== "transparent") params.set("backgroundColor", bg);
  return `${DICEBEAR_BASE}?${params.toString()}`;
}

function parseAvatar(url: string | null | undefined) {
  if (!url || !url.startsWith(DICEBEAR_BASE)) {
    return { seed: "", bg: "transparent" };
  }
  try {
    const u = new URL(url);
    return {
      seed: u.searchParams.get("seed") ?? "",
      bg: u.searchParams.get("backgroundColor") ?? "transparent",
    };
  } catch {
    return { seed: "", bg: "transparent" };
  }
}

const PAGE_SIZE = 10;

export function ProfileEditor() {
  const router = useRouter();
  const utils = api.useUtils();
  const [me] = api.user.me.useSuspenseQuery();

  const initial = useMemo(() => parseAvatar(me?.image), [me?.image]);
  const [name, setName] = useState(me?.name ?? "");
  const [seed, setSeed] = useState(initial.seed || "0");
  const [bg, setBg] = useState(initial.bg);
  const [page, setPage] = useState(() => {
    const n = Number(initial.seed);
    return Number.isInteger(n) && n >= 0 ? Math.floor(n / PAGE_SIZE) : 0;
  });

  const options = useMemo(
    () =>
      Array.from({ length: PAGE_SIZE }, (_, i) => String(page * PAGE_SIZE + i)),
    [page],
  );

  const previewUrl = buildAvatarUrl(seed, bg);

  const save = api.user.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("Profile updated");
      await utils.user.me.invalidate();
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate({ name: name.trim(), image: previewUrl });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <PageTitle>Profile</PageTitle>
        <p className="text-sm text-white/70">
          Pick a name and avatar. Avatars use Lorelei from DiceBear.
        </p>
      </div>

      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <img
            alt="Avatar preview"
            className="h-20 w-20 rounded-full border border-white/10"
            src={previewUrl}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="truncate font-medium">{name || "Your name"}</div>
            <div className="truncate text-xs text-white/70">{me?.email}</div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            required
            value={name}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Pick an avatar</Label>
            <div className="flex items-center gap-1 text-xs text-white/70">
              <Button
                aria-label="Previous page"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                size="icon-xs"
                type="button"
                variant="quiet"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="tabular-nums">Page {page + 1}</span>
              <Button
                aria-label="Next page"
                onClick={() => setPage((p) => p + 1)}
                size="icon-xs"
                type="button"
                variant="quiet"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {options.map((s) => {
              const active = s === seed;
              return (
                <Swatch
                  className="aspect-square"
                  key={s}
                  onClick={() => setSeed(s)}
                  selected={active}
                  shape="square"
                >
                  <img
                    alt=""
                    className="h-full w-full"
                    src={buildAvatarUrl(s, bg)}
                  />
                </Swatch>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Background color</Label>
          <div className="flex flex-wrap gap-2">
            {BG_COLORS.map((c) => {
              const active = c === bg;
              const isTransparent = c === "transparent";
              return (
                <Swatch
                  aria-label={isTransparent ? "No background" : `#${c}`}
                  className="h-10 w-14"
                  color={isTransparent ? undefined : `#${c}`}
                  key={c}
                  onClick={() => setBg(c)}
                  selected={active}
                  shape="square"
                >
                  {isTransparent ? (
                    <Ban className="h-4 w-4 text-white/40" />
                  ) : null}
                </Swatch>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button disabled={save.isPending || !name.trim()} type="submit">
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
