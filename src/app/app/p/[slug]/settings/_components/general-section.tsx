"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import { Section } from "./section";

const COLORS = [
  "#6366f1",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#14b8a6",
  "#ec4899",
];

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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
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

  const dirty =
    !!project &&
    (name.trim() !== project.name ||
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
            {COLORS.map((c) => {
              const active = (color ?? "#6366f1") === c;
              return (
                <button
                  aria-label={`Color ${c}`}
                  className={`h-7 w-7 rounded-full border transition ${
                    active
                      ? "border-white/80 ring-2 ring-white/30"
                      : "border-white/10 hover:border-white/40"
                  } ${!canWrite ? "cursor-not-allowed opacity-50" : ""}`}
                  disabled={!canWrite}
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ background: c }}
                  type="button"
                />
              );
            })}
          </div>
        </div>
        <div className="flex justify-end">
          <Button disabled={!canWrite || !dirty || update.isPending} type="submit">
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
        {!canWrite ? (
          <p className="text-xs text-white/50">
            Read-only — viewers can&apos;t edit project details.
          </p>
        ) : null}
      </form>
    </Section>
  );
}
