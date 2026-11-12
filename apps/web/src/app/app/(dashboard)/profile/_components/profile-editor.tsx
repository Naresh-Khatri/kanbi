"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AvatarPicker } from "@/components/avatar-picker";
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
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import { UserAvatar } from "@/components/user-avatar";
import { AVATAR_BG_COLORS, buildAvatarUrl, parseAvatar } from "@/lib/avatar";
import { api } from "@/trpc/react";

export function ProfileEditor() {
  const router = useRouter();
  const utils = api.useUtils();
  const [me] = api.user.me.useSuspenseQuery();

  const initial = useMemo(() => parseAvatar(me?.image), [me?.image]);
  const [name, setName] = useState(me?.name ?? "");
  const [seed, setSeed] = useState(initial?.seed || "0");
  const [bg, setBg] = useState<string>(initial?.bg ?? AVATAR_BG_COLORS[0]);

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

        <AvatarPicker
          bg={bg}
          onBgChange={setBg}
          onSeedChange={setSeed}
          seed={seed}
        />
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
