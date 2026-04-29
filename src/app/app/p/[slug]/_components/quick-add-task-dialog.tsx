"use client";

import {
  CalendarDays,
  Check,
  Image as ImageIcon,
  Paperclip,
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
    setTitle("");
    setDescription("");
    setPriority("none");
    setDueAt("");
    setAssigneeId(null);
    setSelectedLabelIds(new Set());
    setColumnId(defaultColumnId);
    titleInputRef.current?.focus();
  }

  const create = api.task.create.useMutation();
  const setLabel = api.label.setOnTask.useMutation();
  const createUploadUrl = api.attachment.createUploadUrl.useMutation();
  const createAttachment = api.attachment.create.useMutation();

  const [submitting, setSubmitting] = useState(false);

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

      await utils.board.get.invalidate({ boardId });
      toast.success("Task created");

      if (keepOpen) {
        resetForm();
      } else {
        onOpenChange(false);
      }
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

  const currentColumn = sortedColumns.find((c) => c.id === columnId) ?? null;
  const currentMember = members.data?.find((m) => m.userId === assigneeId);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-w-xl p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleInputRef.current?.focus();
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b border-white/10 px-5 py-3">
            <DialogTitle className="text-sm text-white/70">
              New task in{" "}
              <ColumnPicker
                columns={sortedColumns}
                onChange={setColumnId}
                value={columnId}
              />
            </DialogTitle>
            <DialogDescription className="sr-only">
              Create a new task with full details
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-5 py-4">
            <Input
              className="border-0 bg-transparent px-0 text-base font-medium focus-visible:ring-0"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Task title"
              ref={titleInputRef}
              value={title}
            />
            <RichTextEditor
              minHeight="72px"
              onChange={setDescription}
              placeholder="Add a description…"
              value={description}
            />

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
                icon={<UserIcon className="h-3.5 w-3.5" />}
                label={currentMember ? currentMember.name : "Assignee"}
              >
                <AssigneeMenu
                  members={members.data ?? []}
                  onChange={setAssigneeId}
                  value={assigneeId}
                />
              </MetaChip>

              <label className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 transition focus-within:border-white/30 hover:border-white/20 hover:text-white">
                <CalendarDays className="h-3.5 w-3.5" />
                <input
                  className="w-[110px] bg-transparent text-xs [color-scheme:dark] outline-none"
                  onChange={(e) => setDueAt(e.target.value)}
                  type="date"
                  value={dueAt}
                />
              </label>

              <MetaChip
                icon={<Tag className="h-3.5 w-3.5" />}
                label={
                  selectedLabelIds.size > 0
                    ? `${selectedLabelIds.size} label${selectedLabelIds.size > 1 ? "s" : ""}`
                    : "Labels"
                }
              >
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

          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
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
        Unassigned
        {value === null ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
      </DropdownMenuItem>
      {members.map((m) => (
        <DropdownMenuItem key={m.userId} onSelect={() => onChange(m.userId)}>
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
