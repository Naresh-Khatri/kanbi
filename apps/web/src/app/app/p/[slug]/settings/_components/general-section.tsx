"use client";

import { Swatch } from "@/components/ui/swatch";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_PROJECT_COLOR, PROJECT_COLORS } from "@/lib/palette";
import { api } from "@/trpc/react";
import { Section } from "./section";

export function GeneralSection({
  projectId,
  slug,
  canWrite,
}: {
  projectId: string;
  slug: string;
  canWrite: boolean;
}) {
  const utils = api.useUtils();
  const project = api.project.bySlug.useQuery({ slug }).data;
  const isOwner = project?.role === "owner";
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setKey(project.key);
    setDescription(project.description ?? "");
    setColor(project.color ?? null);
  }, [project]);

  const update = api.project.update.useMutation({
    onSuccess: async () => {
      toast.success("Project updated");
      await Promise.all([
        utils.project.bySlug.invalidate({ slug }),
        utils.project.list.invalidate(),
      ]);
    },
    onError: (err) => toast.error(err.message),
  });

  const keyChanged = !!project && isOwner && key !== project.key;
  const dirty =
    !!project &&
    (name.trim() !== project.name ||
      keyChanged ||
      (description.trim() || null) !== (project.description ?? null) ||
      (color ?? null) !== (project.color ?? null));

  return (
    <Section
      description="The basics — name, description, and a color to spot it in lists."
      id="general"
      title="General"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canWrite) return;
          update.mutate({
            projectId,
            name: name.trim() || undefined,
            key: keyChanged ? key : undefined,
            description: description.trim() ? description.trim() : null,
            color,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-name">Name</Label>
          <Input
            disabled={!canWrite}
            id="settings-name"
            onChange={(e) => setName(e.target.value)}
            required
            value={name}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-key">Ticket key</Label>
          <Input
            className="font-mono uppercase"
            disabled={!isOwner}
            id="settings-key"
            maxLength={10}
            onChange={(e) =>
              setKey(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 10),
              )
            }
            value={key}
          />
          <p className="text-xs text-white/40">
            Prefix for ticket ids like{" "}
            <span className="font-mono">{key || "KEY"}-123</span>.{" "}
            {isOwner
              ? "Renaming it changes how new mentions read; existing ticket numbers keep their value."
              : "Only the project owner can change this."}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-description">Description</Label>
          <Textarea
            disabled={!canWrite}
            id="settings-description"
            onChange={(e) => setDescription(e.target.value)}
            value={description}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => {
              const active = (color ?? DEFAULT_PROJECT_COLOR) === c;
              return (
                <Swatch
                  aria-label={`Color ${c}`}
                  className="size-7"
                  color={c}
                  disabled={!canWrite}
                  key={c}
                  onClick={() => setColor(c)}
                  selected={active}
                />
              );
            })}
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={!canWrite || !dirty || update.isPending}
            type="submit"
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
        {!canWrite ? (
          <p className="text-xs text-white/70">
            Read-only — viewers can&apos;t edit project details.
          </p>
        ) : null}
      </form>
    </Section>
  );
}
