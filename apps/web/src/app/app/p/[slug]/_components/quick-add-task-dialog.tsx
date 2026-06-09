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
  CalendarDays,
  Check,
  ChevronDown,
  GripVertical,
  Image as ImageIcon,
  ListChecks,
  Paperclip,
  Sparkles,
  Tag,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, Textarea } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";
import {
  PRIORITIES,
  PRIORITY_META,
  type Priority,
  PriorityIcon,
} from "./priority";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dueInputRef = useRef<HTMLInputElement>(null);

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
    if (isDirty() && !window.confirm("Discard this task? Your work will be lost.")) {
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
    };
    try {
      const res = await enhance.mutateAsync({
        boardId,
        title: title.trim(),
        description: isEmptyHtml(description) ? undefined : description,
      });
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

      const checklistTexts = [
        ...checklist.map((it) => it.text),
        checklistText,
      ]
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

  const currentMember = members.data?.find((m) => m.userId === assigneeId);

  return (
    <Dialog onOpenChange={requestClose} open={open}>
      <DialogContent
        className="flex max-h-[85vh] w-full max-w-xl flex-col gap-0 p-0"
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
                columns={sortedColumns}
                onChange={setColumnId}
                value={columnId}
              />
            </DialogTitle>
            <button
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-xs text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!title.trim() || enhance.isPending}
              onClick={handleEnhance}
              title="Rewrite the title and description with AI"
              type="button"
            >
              <Sparkles
                className={cn(
                  "h-3.5 w-3.5",
                  enhance.isPending && "animate-pulse",
                )}
              />
              {enhance.isPending ? "Enhancing…" : "Enhance"}
            </button>
            <DialogDescription className="sr-only">
              Create a new task with full details
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-2">
              <Input
                className="flex-1 border-0 bg-transparent px-0 text-base font-medium focus-visible:ring-0"
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  // Plain Enter must not submit (only ⌘/Ctrl+Enter, handled on the form).
                  if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                  }
                }}
                placeholder="Task title"
                ref={titleInputRef}
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
                  className="h-7 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
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
                />
              </div>
            </div>

            {staged.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {staged.map((s) => (
                  <div
                    className="group relative overflow-hidden rounded-md border border-white/10 bg-white/[0.04]"
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
                        <span className="truncate text-[10px] leading-tight">
                          {s.file.name}
                        </span>
                      </div>
                    )}
                    <button
                      aria-label="Remove attachment"
                      className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
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
              <MetaChip
                icon={
                  <PriorityIcon className="h-3.5 w-3.5" priority={priority} />
                }
                label={
                  priority === "none"
                    ? "Priority"
                    : PRIORITY_META[priority].label
                }
              >
                <PriorityMenu onChange={setPriority} value={priority} />
              </MetaChip>

              <MetaChip
                icon={
                  currentMember ? (
                    <UserAvatar
                      image={currentMember.image}
                      name={currentMember.name}
                      size={16}
                    />
                  ) : (
                    <UserIcon className="h-3.5 w-3.5" />
                  )
                }
                label={currentMember ? currentMember.name : "Assignee"}
              >
                <AssigneeMenu
                  members={members.data ?? []}
                  onChange={setAssigneeId}
                  value={assigneeId}
                />
              </MetaChip>

              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] text-xs text-white/70 transition focus-within:border-white/30 hover:border-white/20">
                <button
                  className="inline-flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-2.5 hover:text-white"
                  onClick={() => dueInputRef.current?.showPicker?.()}
                  type="button"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {dueAt ? formatDue(dueAt) : "Due date"}
                </button>
                {dueAt ? (
                  <button
                    aria-label="Clear due date"
                    className="pr-2 pl-0.5 text-white/40 hover:text-white"
                    onClick={() => setDueAt("")}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="pr-2" />
                )}
                <input
                  aria-label="Due date"
                  className="pointer-events-none h-0 w-0 opacity-0"
                  onChange={(e) => setDueAt(e.target.value)}
                  ref={dueInputRef}
                  tabIndex={-1}
                  type="date"
                  value={dueAt}
                />
              </div>

              <MetaChip icon={<Tag className="h-3.5 w-3.5" />} label="Labels">
                <LabelsMenu
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
              </MetaChip>

              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 transition hover:border-white/20 hover:text-white"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                {staged.length > 0 ? `${staged.length} attached` : "Attach"}
              </button>
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
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] text-black"
                      key={l.id}
                      style={{ background: l.color }}
                    >
                      {l.name}
                    </span>
                  ))}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-white/10 px-5 py-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-white/70 select-none">
              <CheckSquare
                checked={keepOpen}
                onChange={() => setKeepOpen((v) => !v)}
              />
              Create more
            </label>
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-white/40 sm:block">
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

function formatDue(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChecklistBullet({ faint }: { faint?: boolean }) {
  return (
    <span
      aria-hidden
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          faint ? "bg-white/15" : "bg-white/30",
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
        "group flex items-center gap-1.5",
        isDragging && "opacity-60",
      )}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        aria-label="Drag to reorder"
        className="shrink-0 cursor-grab text-white/20 opacity-0 transition group-hover:opacity-100 hover:text-white/60 active:cursor-grabbing"
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <ChecklistBullet />
      <Input
        aria-label="Checklist item"
        className="h-7 flex-1 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
        onChange={(e) => onChange(item.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) e.preventDefault();
        }}
        value={item.text}
      />
      <button
        aria-label="Remove item"
        className="shrink-0 text-white/40 opacity-0 transition group-hover:opacity-100 hover:text-white"
        onClick={() => onRemove(item.id)}
        type="button"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CheckSquare({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded border transition",
        checked
          ? "border-white bg-white text-black"
          : "border-white/25 bg-transparent hover:border-white/50",
      )}
      onClick={onChange}
      role="checkbox"
      type="button"
    >
      {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </button>
  );
}

function MetaChip({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 capitalize transition hover:border-white/20 hover:text-white"
          type="button"
        >
          {icon}
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColumnPicker({
  columns,
  value,
  onChange,
}: {
  columns: ColumnRow[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const current = columns.find((c) => c.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium text-white transition hover:bg-white/5"
          type="button"
        >
          {current?.name ?? "column"}
          <ChevronDown className="h-3 w-3 text-white/40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {columns.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => onChange(c.id)}>
            {c.name}
            {c.id === value ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PriorityMenu({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  return (
    <>
      {PRIORITIES.map((p) => (
        <DropdownMenuItem key={p} onSelect={() => onChange(p)}>
          <PriorityIcon className="mr-2 h-3.5 w-3.5" priority={p} />
          {PRIORITY_META[p].label}
          {p === value ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function AssigneeMenu({
  value,
  members,
  onChange,
}: {
  value: string | null;
  members: RouterOutputs["project"]["members"];
  onChange: (id: string | null) => void;
}) {
  return (
    <>
      <DropdownMenuItem onSelect={() => onChange(null)}>
        <span className="flex h-5 w-5 items-center justify-center">
          <UserIcon className="h-3.5 w-3.5 text-white/50" />
        </span>
        Unassigned
        {value === null ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
      </DropdownMenuItem>
      {members.map((m) => (
        <DropdownMenuItem key={m.userId} onSelect={() => onChange(m.userId)}>
          <UserAvatar image={m.image} name={m.name} size={20} />
          {m.name}
          {value === m.userId ? (
            <Check className="ml-auto h-3.5 w-3.5" />
          ) : null}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function LabelsMenu({
  labels,
  selected,
  onToggle,
}: {
  labels: LabelRow[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
}) {
  if (labels.length === 0) {
    return (
      <DropdownMenuItem disabled>
        No labels yet — create one from the task detail panel
      </DropdownMenuItem>
    );
  }
  return (
    <>
      {labels.map((l) => {
        const on = selected.has(l.id);
        return (
          <DropdownMenuItem
            key={l.id}
            onSelect={(e) => {
              e.preventDefault();
              onToggle(l.id, !on);
            }}
          >
            <span
              className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: l.color }}
            />
            {l.name}
            {on ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
