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
        className="h-10 w-72 shrink-0 justify-start"
        onClick={() => setOpen(true)}
        variant="outline"
      >
        <Plus className="h-4 w-4" /> Add column
      </Button>
    );
  }
  return (
    <form
      className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-white/[0.03] p-3"
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
