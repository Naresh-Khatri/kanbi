"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    onError: (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button
        className="h-10 w-[calc(100vw-2rem)] shrink-0 snap-center justify-start md:w-72 md:[scroll-snap-align:none]"
        onClick={() => setOpen(true)}
        variant="outline"
      >
        <Plus className="h-4 w-4" /> Add column
      </Button>
    );
  }
  return (
    <form
      className="flex w-[calc(100vw-2rem)] shrink-0 snap-center flex-col gap-2 rounded-lg bg-white/5 p-3 md:w-72 md:[scroll-snap-align:none]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        create.mutate({ boardId, name: name.trim() });
      }}
    >
      <Input
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Column name"
        value={name}
      />
      <div className="flex gap-2">
        <Button disabled={create.isPending} size="sm" type="submit">
          Add
        </Button>
        <Button
          onClick={() => setOpen(false)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
