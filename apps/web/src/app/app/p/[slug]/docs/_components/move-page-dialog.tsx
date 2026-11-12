"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";
import { descendantIds, type DocumentList } from "./tree";

// base ui select treats "" as no value
const ROOT = "__root__";

export function MovePageDialog({
  documentId,
  onClose,
  projectId,
  documents,
}: {
  documentId: string | null;
  onClose: () => void;
  projectId: string;
  documents: DocumentList;
}) {
  const utils = api.useUtils();
  const current = documents.find((document) => document.id === documentId);
  const currentParent = current?.parentId ?? ROOT;
  const [parentId, setParentId] = useState(currentParent);
  useEffect(() => setParentId(currentParent), [currentParent, documentId]);

  const items = useMemo(() => {
    if (!documentId) return [];
    const blocked = descendantIds(documents, documentId);
    return [
      { value: ROOT, label: "Top level" },
      ...documents
        .filter((d) => d.id !== documentId && !blocked.has(d.id))
        .map((d) => ({ value: d.id, label: d.title })),
    ];
  }, [documentId, documents]);

  const move = api.document.move.useMutation({
    onSuccess: async () => {
      await utils.document.list.invalidate({ projectId });
      onClose();
      toastManager.add({ type: "success", title: "Page moved" });
    },
    onError: (error) =>
      toastManager.add({ type: "error", title: error.message }),
  });

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={documentId !== null}
    >
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move page</DialogTitle>
          <DialogDescription>
            {current ? `“${current.title}” moves` : "The page moves"} to the end
            of the section you pick.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <Field>
            <FieldLabel>Parent</FieldLabel>
            <Select
              items={items}
              onValueChange={(value) => {
                if (value) setParentId(value);
              }}
              value={parentId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </Field>
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button
            disabled={!documentId || parentId === currentParent}
            loading={move.isPending}
            onClick={() => {
              if (!documentId) return;
              move.mutate({
                projectId,
                documentId,
                parentId: parentId === ROOT ? null : parentId,
                beforeId: null,
                afterId: null,
              });
            }}
          >
            Move page
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
