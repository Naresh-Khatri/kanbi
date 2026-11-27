"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";

// base ui select treats "" as no value
const NONE = "__none__";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function CloseMilestoneDialog({
  boardId,
  projectSlug,
  milestone,
  finishedCount,
  unfinishedCount,
  otherMilestones,
  onOpenChange,
  onClosed,
}: {
  boardId: string;
  projectSlug: string;
  /** null = dialog closed */
  milestone: { id: string; name: string } | null;
  finishedCount: number;
  unfinishedCount: number;
  /** open milestones unfinished work can carry over to */
  otherMilestones: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  onClosed?: (milestoneId: string) => void;
}) {
  const utils = api.useUtils();
  const router = useRouter();
  const [moveTo, setMoveTo] = useState(NONE);
  const [archive, setArchive] = useState(true);
  const [summary, setSummary] = useState(false);

  const items = useMemo(
    () => [
      { value: NONE, label: "No milestone" },
      ...otherMilestones.map((m) => ({ value: m.id, label: m.name })),
    ],
    [otherMilestones],
  );

  useEffect(() => {
    if (!milestone) return;
    setMoveTo(otherMilestones[0]?.id ?? NONE);
    setArchive(true);
    setSummary(false);
    // only reset when a new milestone is opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone?.id]);

  const close = api.milestone.close.useMutation({
    onSuccess: async (res, vars) => {
      await Promise.all([
        utils.board.get.invalidate({ boardId }),
        utils.milestone.list.invalidate({ boardId }),
        res.documentId ? utils.document.list.invalidate() : null,
      ]);
      const parts = [
        res.archived > 0 ? `${plural(res.archived, "task")} archived` : null,
        res.carried > 0
          ? `${res.carried} moved to ${res.carriedTo?.name ?? "no milestone"}`
          : null,
      ].filter(Boolean);
      const docId = res.documentId;
      toastManager.add({
        type: "success",
        title: `${milestone?.name ?? "Milestone"} closed`,
        description: parts.join(" · ") || undefined,
        actionProps: docId
          ? {
              children: "Open summary",
              onClick: () => router.push(`/app/p/${projectSlug}/docs/${docId}`),
            }
          : undefined,
      });
      onOpenChange(false);
      onClosed?.(vars.milestoneId);
    },
    onError: (err) => toastManager.add({ type: "error", title: err.message }),
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={milestone !== null}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close {milestone?.name}</DialogTitle>
          <DialogDescription>
            {plural(finishedCount, "finished task")},{" "}
            {plural(unfinishedCount, "unfinished task")}. It moves to history in
            project settings.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-4">
          {unfinishedCount > 0 ? (
            <Field>
              <FieldLabel>Move unfinished tasks to</FieldLabel>
              <Select
                items={items}
                onValueChange={(v) => {
                  if (v) setMoveTo(v);
                }}
                value={moveTo}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {items.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </Field>
          ) : null}
          <div className="flex flex-col gap-2.5">
            <Label className="font-normal">
              <Checkbox
                checked={archive}
                disabled={finishedCount === 0}
                onCheckedChange={(v) => setArchive(v === true)}
              />
              Archive finished tasks
            </Label>
            <Label className="font-normal">
              <Checkbox
                checked={summary}
                onCheckedChange={(v) => setSummary(v === true)}
              />
              Write a summary doc
              <span className="text-ai-foreground text-xs">AI</span>
            </Label>
          </div>
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button
            loading={close.isPending}
            onClick={() => {
              if (!milestone) return;
              close.mutate({
                boardId,
                milestoneId: milestone.id,
                moveUnfinishedTo: moveTo === NONE ? null : moveTo,
                archiveFinished: archive,
                writeSummary: summary,
              });
            }}
          >
            Close milestone
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
