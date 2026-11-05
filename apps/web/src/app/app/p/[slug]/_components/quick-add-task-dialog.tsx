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
  GripVertical,
  Image as ImageIcon,
  ListChecks,
  Paperclip,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge, Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { UserAvatar } from "@/components/ui/user-avatar";
import { htmlToMarkdown } from "@/lib/html-to-markdown";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";
import { ColumnPicker } from "./column-picker";
import type { Priority } from "./priority";
import {
  AssigneePicker,
  DueDatePicker,
  LabelsChip,
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
  const isEmptyHtml = (html: string) =>
    !html || html.replace(/<[^>]*>/g, "").trim().length === 0;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const members = api.project.members.useQuery(
    { projectId },
    { enabled: open },
  );

  useEffect(() => {
    if (open) {
      setColumnId(defaultColumnId);
      titleInputRef.current?.focus();
    }
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
    setChecklist((prev) => [
      ...prev,
      { id: `cl-${Math.random().toString(36).slice(2, 9)}`, text: value },
    ]);
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
      !isEmptyHtml(description) ||
      checklist.length > 0 ||
      checklistText.trim().length > 0 ||
      staged.length > 0 ||
      selectedLabelIds.size > 0 ||
      assigneeId !== null ||
      dueAt !== ""
    );
  }

  function requestClose(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (
      isDirty() &&
      !window.confirm("Discard this task? Your work will be lost.")
    ) {
      return;
    }
    resetForm();
    onOpenChange(false);
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
    // Snapshot so the user can undo the (partly destructive) rewrite.
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
        description: isEmptyHtml(description) ? undefined : description,
      });
      setSourceText(
        (prev) =>
          prev ??
          [title.trim(), isEmptyHtml(description) ? "" : htmlToMarkdown(description)]
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
            .map((text) => ({
              id: `cl-${Math.random().toString(36).slice(2, 9)}`,
              text,
            }));
          return [...prev, ...additions];
        });
      }
      toast.success("Task enhanced", {
        action: {
          label: "Undo",
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
      toast.error((err as Error).message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !columnId || submitting) return;
    setSubmitting(true);
    try {
      const row = await create.mutateAsync({
        boardId,
        columnId,
        title: title.trim(),
        description: isEmptyHtml(description) ? undefined : description,
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
      // Sequential so positionAtEnd keeps the items in the order entered.
      for (const text of checklistTexts) {
        await addChecklistItem.mutateAsync({ boardId, taskId: row.id, text });
      }

      await utils.board.get.invalidate({ boardId });
      toast.success("Task created");

      resetForm();
      if (!keepOpen) onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function onFilesChosen(files: FileList | null) {
    if (!files) return;
    const next: StagedFile[] = [];
    for (const f of Array.from(files)) {
      const isImg = f.type.startsWith("image/");
      next.push({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        previewUrl: isImg ? URL.createObjectURL(f) : null,
      });
    }
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

  return (
    <Dialog onOpenChange={requestClose} open={open}>
      <DialogContent
        className="max-h-dialog flex w-full max-w-xl flex-col gap-0 p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleInputRef.current?.focus();
        }}
      >
        <form
          className="flex min-h-0 flex-1 flex-col"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          onSubmit={handleSubmit}
        >
          <DialogHeader className="flex shrink-0 flex-row justify-between border-b border-white/10 px-5 py-3 pr-10">
            <DialogTitle className="text-sm text-white/70">
              New task in{" "}
              <ColumnPicker
                className="ml-1"
                columns={sortedColumns}
                onChange={setColumnId}
                value={columnId}
              />
            </DialogTitle>
            <Button
              className="shrink-0"
              disabled={!title.trim() || enhance.isPending}
              onClick={handleEnhance}
              size="xs"
              title="Rewrite the title and description with AI"
              type="button"
              variant="ai"
            >
              <Sparkles
                className={cn(
                  "h-3.5 w-3.5",
                  enhance.isPending && "animate-pulse",
                )}
              />
              {enhance.isPending ? "Enhancing…" : "Enhance"}
            </Button>
            <DialogDescription className="sr-only">
              Create a new task with full details
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-2">
              <Input
                className="flex-1 text-base font-medium"
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  // Plain Enter must not submit (only ⌘/Ctrl+Enter, handled on the form).
                  if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                  }
                }}
                placeholder="Task title"
                ref={titleInputRef}
                variant="bare"
                value={title}
              />
            </div>
            <RichTextEditor
              minHeight="72px"
              onChange={setDescription}
              placeholder="Add a description…"
              value={description}
            />

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white/40">
                <ListChecks className="h-3.5 w-3.5" />
                Checklist
              </div>
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
              <div className="flex items-center gap-1.5">
                <span aria-hidden className="w-3.5 shrink-0" />
                <ChecklistBullet faint />
                <Input
                  className="h-7"
                  onChange={(e) => setChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    // Plain Enter adds an item; ⌘/Ctrl+Enter falls through to submit.
                    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                      e.preventDefault();
                      addChecklistStaged();
                    }
                  }}
                  placeholder="Add an item, press Enter"
                  value={checklistText}
                  variant="bare"
                />
              </div>
            </div>

            {staged.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {staged.map((s) => (
                  <div
                    className="group relative overflow-hidden rounded-md border border-white/10 bg-white/5"
                    key={s.id}
                  >
                    {s.previewUrl ? (
                      <img
                        alt={s.file.name}
                        className="h-20 w-20 object-cover"
                        src={s.previewUrl}
                      />
                    ) : (
                      <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 p-2 text-white/70">
                        <Paperclip className="h-4 w-4" />
                        <span className="text-2xs truncate leading-tight">
                          {s.file.name}
                        </span>
                      </div>
                    )}
                    <button
                      aria-label="Remove attachment"
                      className="absolute top-1 right-1 rounded-md bg-black/70 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                      onClick={() => removeStaged(s.id)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
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
                emptyText="No labels yet — create one from the task detail panel"
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
                variant="property"
              >
                <ImageIcon className="h-3.5 w-3.5" />
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

            {selectedLabelIds.size > 0 ? (
              <div className="flex flex-wrap gap-1">
                {labels
                  .filter((l) => selectedLabelIds.has(l.id))
                  .map((l) => (
                    <Badge color={l.color} fill="solid" key={l.id}>
                      {l.name}
                    </Badge>
                  ))}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-white/10 px-5 py-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-white/70 select-none">
              <Checkbox checked={keepOpen} onCheckedChange={setKeepOpen} />
              Create more
            </label>
            <div className="flex items-center gap-2">
              <span className="text-2xs hidden text-white/40 sm:block">
                ⌘+↵ to create
              </span>
              <Button
                disabled={!title.trim() || !columnId || submitting}
                size="sm"
                type="submit"
              >
                {submitting ? "Creating…" : "Create task"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistBullet({ faint }: { faint?: boolean }) {
  return (
    <span
      aria-hidden
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center"
    >
      <Dot
        className={cn("h-1.5 w-1.5", faint ? "bg-white/10" : "bg-white/15")}
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
        "group flex items-center gap-1.5",
        isDragging && "opacity-60",
      )}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Button
        aria-label="Drag to reorder"
        className="cursor-grab opacity-0 group-hover:opacity-100 active:cursor-grabbing"
        size="icon-xs"
        type="button"
        variant="quiet"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </Button>
      <ChecklistBullet />
      <Input
        aria-label="Checklist item"
        className="h-7 flex-1"
        onChange={(e) => onChange(item.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) e.preventDefault();
        }}
        value={item.text}
        variant="bare"
      />
      <Button
        aria-label="Remove item"
        className="opacity-0 group-hover:opacity-100"
        onClick={() => onRemove(item.id)}
        size="icon-xs"
        type="button"
        variant="quiet"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
