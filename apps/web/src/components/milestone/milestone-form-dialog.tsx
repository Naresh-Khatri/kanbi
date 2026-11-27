"use client";

import { formatDate } from "@kanbi/shared";
import { CalendarDaysIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";

export type EditableMilestone = {
  id: string;
  name: string;
  description: string | null;
  targetAt: Date | null;
  status: "upcoming" | "active" | "closed";
};

const STATUS_ITEMS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
] as const;

type OpenStatus = (typeof STATUS_ITEMS)[number]["value"];

/** create when `milestone` is null, edit otherwise */
export function MilestoneFormDialog({
  boardId,
  open,
  onOpenChange,
  milestone,
  initialName = "",
  onSaved,
}: {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone?: EditableMilestone | null;
  initialName?: string;
  onSaved?: (row: { id: string; name: string }) => void;
}) {
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAt, setTargetAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<OpenStatus>("upcoming");
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(milestone?.name ?? initialName);
    setDescription(milestone?.description ?? "");
    setTargetAt(milestone?.targetAt ? new Date(milestone.targetAt) : null);
    setStatus(
      milestone && milestone.status !== "closed"
        ? milestone.status
        : "upcoming",
    );
  }, [open, milestone, initialName]);

  const done = async (row: { id: string; name: string }) => {
    await Promise.all([
      utils.board.get.invalidate({ boardId }),
      utils.milestone.list.invalidate({ boardId }),
    ]);
    onOpenChange(false);
    onSaved?.(row);
  };
  const onError = (err: { message: string }) =>
    toastManager.add({ type: "error", title: err.message });
  const create = api.milestone.create.useMutation({ onSuccess: done, onError });
  const update = api.milestone.update.useMutation({ onSuccess: done, onError });

  const trimmed = name.trim();
  const editing = !!milestone;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="sm:max-w-md">
        <Form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!trimmed) return;
            const fields = {
              boardId,
              name: trimmed,
              description: description.trim() || null,
              targetAt,
            };
            if (milestone) {
              update.mutate({
                ...fields,
                milestoneId: milestone.id,
                // leave closed ones closed; reopening is explicit
                status: milestone.status === "closed" ? undefined : status,
              });
            } else {
              create.mutate({ ...fields, status });
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit milestone" : "New milestone"}
            </DialogTitle>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4">
            <Field name="name">
              <FieldLabel>Name</FieldLabel>
              <Input
                autoFocus
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="v1.2, Launch, Client review…"
                required
                value={name}
              />
            </Field>
            <Field name="description">
              <FieldLabel>Goal</FieldLabel>
              <Textarea
                maxLength={2000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What ships when this is done (optional)"
                value={description}
              />
            </Field>
            <div className="flex flex-wrap gap-4">
              <Field className="min-w-0 flex-1">
                <FieldLabel>Target date</FieldLabel>
                <span className="flex items-center gap-0.5">
                  <Popover onOpenChange={setDateOpen} open={dateOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          className="flex-1 justify-start"
                          type="button"
                          variant="outline"
                        />
                      }
                    >
                      <CalendarDaysIcon aria-hidden="true" />
                      <span
                        className={
                          targetAt ? undefined : "text-muted-foreground"
                        }
                      >
                        {targetAt
                          ? formatDate(targetAt, { relativeDays: false })
                          : "No date"}
                      </span>
                    </PopoverTrigger>
                    <PopoverPopup align="start">
                      <Calendar
                        autoFocus
                        defaultMonth={targetAt ?? undefined}
                        mode="single"
                        onSelect={(d: Date | undefined) => {
                          setTargetAt(d ?? null);
                          setDateOpen(false);
                        }}
                        selected={targetAt ?? undefined}
                      />
                    </PopoverPopup>
                  </Popover>
                  {targetAt ? (
                    <Button
                      aria-label="Clear target date"
                      onClick={() => setTargetAt(null)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  ) : null}
                </span>
              </Field>
              {milestone?.status === "closed" ? null : (
                <Field className="w-36">
                  <FieldLabel>Status</FieldLabel>
                  <Select
                    items={STATUS_ITEMS}
                    onValueChange={(v) => {
                      if (v) setStatus(v);
                    }}
                    value={status}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      {STATUS_ITEMS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </Field>
              )}
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button
              disabled={!trimmed}
              loading={create.isPending || update.isPending}
              type="submit"
            >
              {editing ? "Save" : "Create milestone"}
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}
