"use client";

import { BanIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ColorSwatchGroup } from "@/components/color-swatch-group";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/trpc/react";

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

const BG_OPTIONS = BG_COLORS.map((c) =>
  c === "transparent"
    ? {
        value: c,
        label: "No background",
        children: (
          <BanIcon aria-hidden="true" className="text-muted-foreground" />
        ),
      }
    : { value: c, label: `#${c}`, color: `#${c}` },
);

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
      toastManager.add({ type: "success", title: "Profile updated" });
      await utils.user.me.invalidate();
      router.refresh();
    },
    onError: (err) => toastManager.add({ type: "error", title: err.message }),
  });

  return (
    <Card
      render={
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ name: name.trim(), image: previewUrl });
          }}
        />
      }
    >
      <CardHeader>
        <CardTitle className="text-base" render={<h2 />}>
          Account
        </CardTitle>
        <CardDescription>
          Pick a name and avatar. Avatars use Lorelei from DiceBear.
        </CardDescription>
        <CardAction>
          <UserAvatar
            className="border"
            image={previewUrl}
            name={name || "?"}
            size={56}
          />
        </CardAction>
      </CardHeader>
      <CardPanel className="flex flex-col gap-6">
        <Field name="name">
          <FieldLabel>Display name</FieldLabel>
          <Input
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            required
            value={name}
          />
          <FieldError>Enter a display name.</FieldError>
          {me?.email ? (
            <p className="text-muted-foreground text-xs">
              Signed in as {me.email}
            </p>
          ) : null}
        </Field>

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
              if (v) setSeed(v);
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
            itemClassName="h-8 w-12 rounded-lg sm:h-8"
            onValueChange={setBg}
            options={BG_OPTIONS}
            value={bg}
          />
        </Fieldset>
      </CardPanel>
      <CardFooter className="bg-muted/72 justify-end rounded-b-[calc(var(--radius-2xl)-1px)] border-t py-4">
        <Button
          disabled={!name.trim()}
          loading={save.isPending}
          size="sm"
          type="submit"
        >
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}
