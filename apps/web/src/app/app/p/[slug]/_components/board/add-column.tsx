"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";

export function AddColumn({ boardId }: { boardId: string }) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = api.column.create.useMutation({
    onSuccess: async () => {
      setOpen(false);
      setName("");
      await utils.board.get.invalidate({ boardId });
    },
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });

  if (!open) {
    return (
      <Button
        className="text-muted-foreground shrink-0 snap-center md:[scroll-snap-align:none]"
        onClick={() => setOpen(true)}
        size="sm"
        variant="ghost"
      >
        <PlusIcon aria-hidden="true" /> Add column
      </Button>
    );
  }
  return (
    <form
      className="bg-card flex w-[calc(100vw-2rem)] shrink-0 snap-center flex-col gap-2 rounded-xl border p-2 md:w-72 md:[scroll-snap-align:none]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        create.mutate({ boardId, name: name.trim() });
      }}
    >
      <Input
        aria-label="Column name"
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Column name"
        size="sm"
        value={name}
      />
      <div className="flex justify-end gap-2">
        <Button
          onClick={() => setOpen(false)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button loading={create.isPending} size="sm" type="submit">
          Add
        </Button>
      </div>
    </form>
  );
}
