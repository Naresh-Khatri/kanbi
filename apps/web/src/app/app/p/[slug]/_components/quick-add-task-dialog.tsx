"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVerticalIcon,
  PaperclipIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isRichTextEmpty, RichTextEditor } from "@/components/rich-text/editor";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { htmlToMarkdown } from "@/lib/html-to-markdown";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";
import { ColumnPicker } from "./column-picker";
import type { Priority } from "./priority";
import {
  AssigneePicker,
  DueDatePicker,
  LabelsChip,
  LabelSwatch,
  PriorityPicker,
} from "./task-properties";

type BoardData = RouterOutputs["board"]["get"];
type ColumnRow = BoardData["columns"][number];
type LabelRow = BoardData["labels"][number];

type StagedFile = {
  id: string;
  file: File;
  previewUrl: string | null;
};

type StagedChecklistItem = { id: string; text: string };

const randomId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const toastError = (err: unknown) =>
  toastManager.add({ type: "error", title: (err as Error).message });

export function QuickAddTaskDialog({
  open,
  onOpenChange,
  boardId,
  projectId,
  columns,
  labels,
  initialColumnId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  projectId: string;
  columns: ColumnRow[];
  labels: LabelRow[];
  initialColumnId?: string | null;
}) {
  const utils = api.useUtils();
  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns],
  );
  const defaultColumnId = initialColumnId ?? sortedColumns[0]?.id ?? null;

  const [columnId, setColumnId] = useState<string | null>(defaultColumnId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [dueAt, setDueAt] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(
    new Set(),
  );
  const [keepOpen, setKeepOpen] = useState(false);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [checklist, setChecklist] = useState<StagedChecklistItem[]>([]);
  const [checklistText, setChecklistText] = useState("");
  // pre-enhance wording; first enhance wins so re-enhancing keeps the original
  const [sourceText, setSourceText] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const members = api.project.members.useQuery(
    { projectId },
    { enabled: open },
  );

  useEffect(() => {
    if (open) setColumnId(defaultColumnId);
  }, [open, defaultColumnId]);

  useEffect(() => {
    return () => {
      for (const s of staged) {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      }
    };
  }, [staged]);

  function resetForm() {
    for (const s of staged) {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    }
    setStaged([]);
    setChecklist([]);
    setChecklistText("");
    setSourceText(null);
    setTitle("");
    setDescription("");
    setPriority("none");
    setDueAt("");
    setAssigneeId(null);
    setSelectedLabelIds(new Set());
    setColumnId(defaultColumnId);
    titleInputRef.current?.focus();
  }

  function addChecklistStaged() {
    const value = checklistText.trim();
    if (!value) return;
    setChecklist((prev) => [...prev, { id: randomId("cl"), text: value }]);
    setChecklistText("");
  }

  function removeChecklistItem(id: string) {
    setChecklist((prev) => prev.filter((it) => it.id !== id));
  }

  function updateChecklistItem(id: string, text: string) {
    setChecklist((prev) =>
      prev.map((it) => (it.id === id ? { ...it, text } : it)),
    );
  }

  function isDirty() {
    return (
      title.trim().length > 0 ||
      !isRichTextEmpty(description) ||
      checklist.length > 0 ||
      checklistText.trim().length > 0 ||
      staged.length > 0 ||
      selectedLabelIds.size > 0 ||
      assigneeId !== null ||
      dueAt !== ""
    );
  }

  function discard() {
    setConfirmDiscard(false);
    resetForm();
    onOpenChange(false);
  }

  function requestClose(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (isDirty()) {
      setConfirmDiscard(true);
      return;
    }
    discard();
  }

  const checklistSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleChecklistDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setChecklist((prev) => {
      const from = prev.findIndex((it) => it.id === active.id);
      const to = prev.findIndex((it) => it.id === over.id);
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  }

  const create = api.task.create.useMutation();
  const setLabel = api.label.setOnTask.useMutation();
  const createUploadUrl = api.attachment.createUploadUrl.useMutation();
  const createAttachment = api.attachment.create.useMutation();
  const addChecklistItem = api.checklist.add.useMutation();
  const enhance = api.task.enhance.useMutation();

  const [submitting, setSubmitting] = useState(false);

  async function handleEnhance() {
    if (!title.trim() || enhance.isPending) return;
    // snapshot so the (partly destructive) rewrite can be undone
    const before = {
      title,
      description,
      priority,
      assigneeId,
      dueAt,
      labelIds: new Set(selectedLabelIds),
      checklist,
      sourceText,
    };
    try {
      const res = await enhance.mutateAsync({
        boardId,
        title: title.trim(),
        description: isRichTextEmpty(description) ? undefined : description,
      });
      setSourceText(
        (prev) =>
          prev ??
          [
            title.trim(),
            isRichTextEmpty(description) ? "" : htmlToMarkdown(description),
          ]
            .filter(Boolean)
            .join("\n\n"),
      );
      setTitle(res.title);
      setDescription(res.description ?? "");
      setPriority(res.priority);
      if (res.assigneeId) setAssigneeId(res.assigneeId);
      if (res.dueAt) setDueAt(res.dueAt);
      if (res.labelIds.length > 0) {
        setSelectedLabelIds((prev) => {
          const next = new Set(prev);
          for (const id of res.labelIds) next.add(id);
          return next;
        });
      }
      if (res.checklist.length > 0) {
        setChecklist((prev) => {
          const seen = new Set(prev.map((it) => it.text.trim().toLowerCase()));
          const additions = res.checklist
            .filter((t) => !seen.has(t.trim().toLowerCase()))
            .map((text) => ({ id: randomId("cl"), text }));
          return [...prev, ...additions];
        });
      }
      toastManager.add({
        type: "success",
        title: "Task enhanced",
        actionProps: {
          children: "Undo",
          onClick: () => {
            setTitle(before.title);
            setDescription(before.description);
            setPriority(before.priority);
            setAssigneeId(before.assigneeId);
            setDueAt(before.dueAt);
            setSelectedLabelIds(before.labelIds);
            setChecklist(before.checklist);
            setSourceText(before.sourceText);
          },
        },
      });
    } catch (err) {
      toastError(err);
    }
  }

  async function handleSubmit() {
    if (!title.trim() || !columnId || submitting) return;
    setSubmitting(true);
    try {
      const row = await create.mutateAsync({
        boardId,
        columnId,
        title: title.trim(),
        description: isRichTextEmpty(description) ? undefined : description,
        priority: priority !== "none" ? priority : undefined,
        assigneeId: assigneeId ?? undefined,
        dueAt: dueAt ? new Date(dueAt) : undefined,
        sourceText: sourceText ?? undefined,
      });
      if (!row) throw new Error("Failed to create task");

      if (selectedLabelIds.size > 0) {
        await Promise.all(
          Array.from(selectedLabelIds).map((labelId) =>
            setLabel.mutateAsync({
              boardId,
              taskId: row.id,
              labelId,
              on: true,
            }),
          ),
        );
      }

      if (staged.length > 0) {
        await Promise.all(
          staged.map(async (s) => {
            const mime = s.file.type || "application/octet-stream";
            const { key, uploadUrl } = await createUploadUrl.mutateAsync({
              boardId,
              taskId: row.id,
              filename: s.file.name,
              mime,
              sizeBytes: s.file.size,
            });
            const put = await fetch(uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": mime },
              body: s.file,
            });
            if (!put.ok) throw new Error(`Upload failed: ${s.file.name}`);
            await createAttachment.mutateAsync({
              boardId,
              taskId: row.id,
              key,
              filename: s.file.name,
              mime,
              sizeBytes: s.file.size,
            });
          }),
        );
      }

      const checklistTexts = [...checklist.map((it) => it.text), checklistText]
        .map((t) => t.trim())
        .filter(Boolean);
      // sequential so positionAtEnd keeps entry order
      for (const text of checklistTexts) {
        await addChecklistItem.mutateAsync({ boardId, taskId: row.id, text });
      }

      await utils.board.get.invalidate({ boardId });
      toastManager.add({ type: "success", title: "Task created" });

      resetForm();
      if (!keepOpen) onOpenChange(false);
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function onFilesChosen(files: FileList | null) {
    if (!files) return;
    const next: StagedFile[] = Array.from(files).map((f) => ({
      id: randomId(`${f.name}-${f.size}`),
      file: f,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    }));
    setStaged((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeStaged(id: string) {
    setStaged((prev) => {
      const found = prev.find((s) => s.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }

  const selectedLabels = labels.filter((l) => selectedLabelIds.has(l.id));
  const canSubmit = Boolean(title.trim() && columnId);

  return (
    <>
      <Dialog onOpenChange={requestClose} open={open}>
        <DialogPopup className="max-w-xl" initialFocus={titleInputRef}>
          <Form
            className="flex min-h-0 flex-1 flex-col"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            <DialogHeader className="flex-row items-center gap-2 pe-12 pb-3">
              <DialogTitle className="flex min-w-0 items-center gap-1.5 font-medium font-sans text-muted-foreground text-sm">
                New task in
                <ColumnPicker
                  columns={sortedColumns}
                  onChange={setColumnId}
                  value={columnId}
                />
              </DialogTitle>
              <DialogDescription className="sr-only">
                Create a new task with full details
              </DialogDescription>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      className="ms-auto"
                      disabled={!title.trim()}
                      loading={enhance.isPending}
                      onClick={handleEnhance}
                      size="xs"
                      type="button"
                      variant="outline"
                    />
                  }
                >
                  <SparklesIcon
                    aria-hidden="true"
                    className="text-ai-foreground"
                  />
                  Enhance
                </TooltipTrigger>
                <TooltipPopup>
                  Rewrite the title and description with AI
                </TooltipPopup>
              </Tooltip>
            </DialogHeader>

            <DialogPanel className="flex flex-col gap-4">
              <Field>
                <FieldLabel className="sr-only">Title</FieldLabel>
                <Input
                  className="[&_input]:h-auto [&_input]:px-0 [&_input]:font-semibold [&_input]:text-lg [&_input]:leading-snug"
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    // plain enter must not submit; mod+enter is handled on the form
                    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Task title"
                  ref={titleInputRef}
                  unstyled
                  value={title}
                />
              </Field>
              <RichTextEditor
                minHeight="72px"
                onChange={setDescription}
                placeholder="Add a description…"
                value={description}
              />

              <section
                aria-label="Checklist"
                className="flex flex-col gap-1 border-t pt-4"
              >
                <h3 className="mb-1 font-medium text-muted-foreground text-xs">
                  Checklist
                </h3>
                {checklist.length > 0 ? (
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragEnd={handleChecklistDragEnd}
                    sensors={checklistSensors}
                  >
                    <SortableContext
                      items={checklist.map((it) => it.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {checklist.map((item) => (
                        <SortableChecklistItem
                          item={item}
                          key={item.id}
                          onChange={updateChecklistItem}
                          onRemove={removeChecklistItem}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                ) : null}
                <div className="flex items-center gap-1.5 ps-7">
                  <ChecklistBullet faint />
                  <Input
                    aria-label="New checklist item"
                    className={CHECKLIST_INPUT}
                    onChange={(e) => setChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      // plain enter adds; mod+enter falls through to submit
                      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        addChecklistStaged();
                      }
                    }}
                    placeholder="Add an item, press Enter"
                    size="sm"
                    unstyled
                    value={checklistText}
                  />
                </div>
              </section>

              {staged.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {staged.map((s) => (
                    <div
                      className="group/file relative size-20 overflow-hidden rounded-lg border bg-muted"
                      key={s.id}
                    >
                      {s.previewUrl ? (
                        <img
                          alt={s.file.name}
                          className="size-full object-cover"
                          src={s.previewUrl}
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-muted-foreground">
                          <PaperclipIcon aria-hidden="true" className="size-4" />
                          <span className="w-full truncate text-center text-xs">
                            {s.file.name}
                          </span>
                        </div>
                      )}
                      <Button
                        aria-label={`Remove ${s.file.name}`}
                        className="absolute end-1 top-1 bg-background/80 opacity-0 backdrop-blur-sm focus-visible:opacity-100 group-hover/file:opacity-100 pointer-coarse:opacity-100"
                        onClick={() => removeStaged(s.id)}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-1.5">
                <PriorityPicker onChange={setPriority} value={priority} />
                <AssigneePicker
                  members={members.data ?? []}
                  onChange={setAssigneeId}
                  value={assigneeId}
                />
                <DueDatePicker
                  onChange={(v) => setDueAt(v ?? "")}
                  value={dueAt || null}
                />
                <LabelsChip
                  emptyText="No labels yet. Create one from the task detail panel."
                  labels={labels}
                  onToggle={(id, on) => {
                    setSelectedLabelIds((prev) => {
                      const next = new Set(prev);
                      if (on) next.add(id);
                      else next.delete(id);
                      return next;
                    });
                  }}
                  selected={selectedLabelIds}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  <PaperclipIcon aria-hidden="true" />
                  {staged.length > 0 ? `${staged.length} attached` : "Attach"}
                </Button>
                <input
                  className="hidden"
                  multiple
                  onChange={(e) => onFilesChosen(e.target.files)}
                  ref={fileInputRef}
                  type="file"
                />
              </div>

              {selectedLabels.length > 1 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedLabels.map((l) => (
                    <Badge key={l.id} variant="outline">
                      <LabelSwatch color={l.color} />
                      {l.name}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </DialogPanel>

            <DialogFooter className="items-center sm:justify-between">
              <Label className="cursor-pointer font-normal text-muted-foreground">
                <Checkbox
                  checked={keepOpen}
                  onCheckedChange={(v) => setKeepOpen(v === true)}
                />
                Create more
              </Label>
              <div className="flex items-center gap-2">
                <DialogClose render={<Button variant="ghost" />}>
                  Cancel
                </DialogClose>
                <Button
                  disabled={!canSubmit}
                  loading={submitting}
                  type="submit"
                >
                  Create task
                  <KbdGroup className="max-sm:hidden">
                    <Kbd className="bg-primary-foreground/16 text-primary-foreground">
                      ⌘
                    </Kbd>
                    <Kbd className="bg-primary-foreground/16 text-primary-foreground">
                      ↵
                    </Kbd>
                  </KbdGroup>
                </Button>
              </div>
            </DialogFooter>
          </Form>
        </DialogPopup>
      </Dialog>

      <AlertDialog onOpenChange={setConfirmDiscard} open={confirmDiscard}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this task?</AlertDialogTitle>
            <AlertDialogDescription>
              What you&rsquo;ve entered will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>
              Keep editing
            </AlertDialogClose>
            <Button onClick={discard} variant="destructive">
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}

const CHECKLIST_INPUT =
  "flex-1 [&_input]:h-7 [&_input]:px-1 [&_input]:leading-7 sm:[&_input]:h-6.5 sm:[&_input]:leading-6.5";

function ChecklistBullet({ faint }: { faint?: boolean }) {
  return (
    <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
      <span
        className={cn(
          "size-1.5 rounded-full",
          faint ? "bg-muted-foreground/24" : "bg-muted-foreground/48",
        )}
      />
    </span>
  );
}

function SortableChecklistItem({
  item,
  onRemove,
  onChange,
}: {
  item: StagedChecklistItem;
  onRemove: (id: string) => void;
  onChange: (id: string, text: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <div
      className={cn(
        "group/item flex items-center gap-1.5",
        isDragging && "opacity-60",
      )}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Button
        aria-label="Drag to reorder"
        className="cursor-grab text-muted-foreground opacity-0 focus-visible:opacity-100 active:cursor-grabbing group-hover/item:opacity-100 pointer-coarse:opacity-100"
        size="icon-xs"
        type="button"
        variant="ghost"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon aria-hidden="true" />
      </Button>
      <ChecklistBullet />
      <Input
        aria-label="Checklist item"
        className={CHECKLIST_INPUT}
        onChange={(e) => onChange(item.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) e.preventDefault();
        }}
        size="sm"
        unstyled
        value={item.text}
      />
      <Button
        aria-label="Remove item"
        className="text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover/item:opacity-100 pointer-coarse:opacity-100"
        onClick={() => onRemove(item.id)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <XIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
