"use client";

import { useEffect, useState } from "react";

import { ColorSwatchGroup } from "@/components/color-swatch-group";
import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { DEFAULT_PROJECT_COLOR, PROJECT_COLORS } from "@/lib/palette";
import { api } from "@/trpc/react";
import { Section } from "./section";
import { SectionFooter } from "./section-footer";

const COLOR_OPTIONS = PROJECT_COLORS.map((c) => ({
  value: c,
  label: `Color ${c}`,
  color: c,
}));

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
      toastManager.add({ type: "success", title: "Project updated" });
      await Promise.all([
        utils.project.bySlug.invalidate({ slug }),
        utils.project.list.invalidate(),
      ]);
    },
    onError: (err) => toastManager.add({ type: "error", title: err.message }),
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
      description="The basics: name, description, and a color to spot it in lists."
      id="general"
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
      title="General"
    >
      <CardPanel className="flex flex-col gap-5">
        <Field disabled={!canWrite} name="name">
          <FieldLabel>Name</FieldLabel>
          <Input
            onChange={(e) => setName(e.target.value)}
            required
            value={name}
          />
          <FieldError>Give the project a name.</FieldError>
        </Field>
        <Field disabled={!isOwner} name="key">
          <FieldLabel>Ticket key</FieldLabel>
          <Input
            className="max-w-40 font-mono uppercase"
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
          <FieldDescription>
            Prefix for ticket ids like{" "}
            <span className="font-mono">{key || "KEY"}-123</span>.{" "}
            {isOwner
              ? "Renaming it changes how new mentions read; existing ticket numbers keep their value."
              : "Only the project owner can change this."}
          </FieldDescription>
        </Field>
        <Field disabled={!canWrite} name="description">
          <FieldLabel>Description</FieldLabel>
          <Textarea
            onChange={(e) => setDescription(e.target.value)}
            value={description}
          />
        </Field>
        <Fieldset className="flex flex-col gap-2" disabled={!canWrite}>
          <FieldsetLegend className="text-sm font-medium">Color</FieldsetLegend>
          <ColorSwatchGroup
            aria-label="Project color"
            disabled={!canWrite}
            onValueChange={setColor}
            options={COLOR_OPTIONS}
            value={color ?? DEFAULT_PROJECT_COLOR}
          />
        </Fieldset>
      </CardPanel>
      <SectionFooter
        hint={
          canWrite
            ? undefined
            : "Read-only: viewers can't edit project details."
        }
      >
        <Button
          disabled={!canWrite || !dirty}
          loading={update.isPending}
          size="sm"
          type="submit"
        >
          Save changes
        </Button>
      </SectionFooter>
    </Section>
  );
}
