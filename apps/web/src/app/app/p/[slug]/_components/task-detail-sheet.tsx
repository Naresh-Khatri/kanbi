"use client";

import {
  Check,
  Copy,
  FileText,
  GitBranch,
  Link2,
  Loader2,
  Minus,
  Paperclip,
  Pencil,
  Plus,
  Settings2,
  SquareKanban,
  Sun,
  Tag,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { formatDate, formatDateTime, formatRelative } from "@kanbi/shared";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isRichTextEmpty,
  RichTextContent,
  RichTextEditor,
} from "@/components/ui/rich-text-editor";
import type {
  MentionItem,
  TicketMentionItem,
} from "@/components/ui/rich-text-mention";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Swatch } from "@/components/ui/swatch";
import { SectionLabel } from "@/components/ui/surface";
import { segmentVariants } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/ui/user-avatar";
import { LABEL_COLORS } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";
import {
  BRANCH_TYPES,
  type BranchType,
  buildBranchName,
  copyBranchCommand,
  copyBranchName,
  defaultBranchType,
} from "./copy-branch-command";
import { copyTaskLink } from "./copy-task-link";
import type { Priority } from "./priority";
import {
  AssigneePicker,
  DueDatePicker,
  PriorityPicker,
} from "./task-properties";
import { useUndoableBoardDelete } from "./use-undoable-board-delete";

type BoardData = RouterOutputs["board"]["get"];
type TaskRow = BoardData["tasks"][number];
type ColumnRow = BoardData["columns"][number];
type LabelRow = BoardData["labels"][number];
type PendingUpload = {
  id: string;
  filename: string;
  mime: string;
  previewUrl: string | null;
};

export function TaskDetailSheet({
  open,
  onOpenChange,
  task,
  boardId,
  projectId,
  projectKey,
  columns,
  tasks,
  labels,
  taskLabels,
  canWrite,
  tickets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskRow | null;
  boardId: string;
  projectId: string;
  projectKey: string;
  columns: ColumnRow[];
  tasks: TaskRow[];
  labels: LabelRow[];
  taskLabels: BoardData["taskLabels"];
  canWrite: boolean;
  tickets: TicketMentionItem[];
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="overflow-y-auto">
        {task ? (
          <TaskDetail
            boardId={boardId}
            canWrite={canWrite}
            columns={columns}
            labels={labels}
            onClose={() => onOpenChange(false)}
            projectId={projectId}
            projectKey={projectKey}
            task={task}
            taskLabels={taskLabels.filter((tl) => tl.taskId === task.id)}
            tasks={tasks}
            tickets={tickets}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function TaskDetail({
  task,
  boardId,
  projectId,
  projectKey,
  columns,
  tasks,
  labels,
  taskLabels,
  canWrite,
  onClose,
  tickets,
}: {
  task: TaskRow;
  boardId: string;
  projectId: string;
  projectKey: string;
  columns: ColumnRow[];
  tasks: TaskRow[];
  labels: LabelRow[];
  taskLabels: BoardData["taskLabels"];
  canWrite: boolean;
  onClose: () => void;
  tickets: TicketMentionItem[];
}) {
  const utils = api.useUtils();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");

  const update = api.task.update.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
    onError: (e) => toast.error(e.message),
  });
  const move = api.task.move.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
    onError: (e) => toast.error(e.message),
  });
  const changeColumn = (toColumnId: string) => {
    if (toColumnId === task.columnId) return;
    const last = tasks
      .filter((t) => t.columnId === toColumnId)
      .reduce<TaskRow | null>(
        (max, t) => (!max || t.position > max.position ? t : max),
        null,
      );
    move.mutate({
      boardId,
      taskId: task.id,
      toColumnId,
      before: last ? last.position : null,
      after: null,
    });
  };
  const remove = useUndoableBoardDelete(boardId);
  const me = api.user.me.useQuery();
  const members = api.project.members.useQuery(
    { projectId },
    { enabled: canWrite },
  );
  const mentionItems = useMemo(
    () =>
      (members.data ?? []).map((m) => ({
        id: m.userId,
        label: m.name,
        image: m.image,
        sublabel: m.email,
      })),
    [members.data],
  );

  const activeLabelIds = new Set(taskLabels.map((tl) => tl.labelId));

  return (
    <div className="flex flex-col gap-5">
      <CopyLinkButton taskId={task.id} />
      <SheetHeader className="pr-20">
        <span className="font-mono text-xs text-white/40">
          {projectKey}-{task.number}
        </span>
        <SheetTitle>
          <TitleField
            disabled={!canWrite}
            onChange={setTitle}
            onCommit={() => {
              if (title.trim() && title !== task.title) {
                update.mutate({ boardId, taskId: task.id, title });
              }
            }}
            value={title}
          />
        </SheetTitle>
        <SheetDescription>
          Updated{" "}
          <span title={formatDateTime(task.updatedAt ?? task.createdAt)}>
            {formatRelative(task.updatedAt ?? task.createdAt)}
          </span>
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-y border-white/10 py-2.5">
        <StatusMenu
          canWrite={canWrite}
          columns={columns}
          onChange={changeColumn}
          value={task.columnId}
        />
        <PriorityPicker
          disabled={!canWrite}
          onChange={(p) =>
            update.mutate({ boardId, taskId: task.id, priority: p })
          }
          size="row"
          value={task.priority as Priority}
        />
        <AssigneePicker
          disabled={!canWrite}
          members={members.data ?? []}
          onChange={(id) =>
            update.mutate({ boardId, taskId: task.id, assigneeId: id })
          }
          selfId={me.data?.id ?? null}
          size="row"
          value={task.assigneeId}
        />
        <EstimateControl
          canWrite={canWrite}
          onChange={(n) =>
            update.mutate({ boardId, taskId: task.id, estimatePomodoros: n })
          }
          value={task.estimatePomodoros}
        />
        <DueControl
          canWrite={canWrite}
          onChange={(d) =>
            update.mutate({ boardId, taskId: task.id, dueAt: d })
          }
          value={task.dueAt}
        />
        <LabelsPicker
          activeLabelIds={activeLabelIds}
          boardId={boardId}
          canWrite={canWrite}
          labels={labels}
          taskId={task.id}
        />
        <BranchMenu
          labelNames={labels
            .filter((l) => activeLabelIds.has(l.id))
            .map((l) => l.name)}
          task={task}
        />
        <TodayToggle taskId={task.id} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Description</Label>
        <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
          <RichTextEditor
            disabled={!canWrite}
            mentions={mentionItems}
            tickets={tickets}
            minHeight="120px"
            onBlur={() => {
              if (description !== (task.description ?? "")) {
                update.mutate({
                  boardId,
                  taskId: task.id,
                  description: description || null,
                });
              }
            }}
            onChange={setDescription}
            placeholder="Add a description…"
            value={description}
          />
        </div>
      </div>

      <LinkedDocsPanel boardId={boardId} taskId={task.id} />

      <ChecklistPanel boardId={boardId} canWrite={canWrite} taskId={task.id} />
      <AttachmentsPanel
        boardId={boardId}
        canWrite={canWrite}
        taskId={task.id}
      />
      <CommentsPanel
        boardId={boardId}
        canWrite={canWrite}
        mentions={mentionItems}
        taskId={task.id}
        tickets={tickets}
      />
      <ActivityPanel boardId={boardId} taskId={task.id} />

      {canWrite ? (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() =>
              void remove(
                { kind: "task", id: task.id, name: task.title },
                onClose,
              )
            }
            variant="destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete task
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function LinkedDocsPanel({
  boardId,
  taskId,
}: {
  boardId: string;
  taskId: string;
}) {
  const linked = api.document.linkedToTask.useQuery({ boardId, taskId });
  if (!linked.data || linked.data.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <Label>Docs</Label>
      <div className="divide-y divide-white/10 rounded-md border border-white/10 bg-white/5 px-2">
        {linked.data.map((document) => (
          <Link
            className="group flex items-center gap-2 rounded-md px-1 py-2 text-sm text-white/70 transition hover:text-white focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
            href={`/app/p/${document.projectSlug}/docs/${document.id}`}
            key={document.id}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-white/40 group-hover:text-white/70" />
            <span className="truncate">{document.title}</span>
            <span className="text-2xs ml-auto shrink-0 text-white/40">
              {formatRelative(document.updatedAt ?? document.createdAt)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const PROP_CLS = "max-w-full";
const PROP_ICON = "h-4 w-4 shrink-0 text-white/40";
const PROP_PLACEHOLDER = "text-white/40";

function DueControl({
  value,
  onChange,
  canWrite,
}: {
  value: Date | string | null;
  onChange: (d: Date | null) => void;
  canWrite: boolean;
}) {
  const has = value != null;
  return (
    <DueDatePicker
      disabled={!canWrite}
      label={has ? formatDate(value) : undefined}
      onChange={(v) => onChange(v ? new Date(v) : null)}
      size="row"
      value={has ? new Date(value).toISOString().slice(0, 10) : null}
    />
  );
}

// 25-min focus blocks. compact stepper: click the label to start at 1, then +/-, X clears.
function EstimateControl({
  value,
  onChange,
  canWrite,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  canWrite: boolean;
}) {
  const has = value != null;
  const dec = () => {
    if (!has) return;
    onChange(value > 1 ? value - 1 : null);
  };
  const inc = () => onChange(has ? Math.min(16, value + 1) : 1);
  return (
    <div className="inline-flex items-center">
      {has && canWrite ? (
        <Button
          aria-label="Decrease estimate"
          onClick={dec}
          size="icon-xs"
          type="button"
          variant="quiet"
        >
          <Minus className="h-3 w-3" />
        </Button>
      ) : null}
      <Button
        className={PROP_CLS}
        size="md"
        variant="property"
        disabled={!canWrite}
        onClick={inc}
        type="button"
      >
        <Timer className={PROP_ICON} />
        <span className={cn("truncate", !has && PROP_PLACEHOLDER)}>
          {has ? `${value} pomodoro${value === 1 ? "" : "s"}` : "Estimate"}
        </span>
      </Button>
      {has && canWrite ? (
        <>
          <Button
            aria-label="Increase estimate"
            onClick={inc}
            size="icon-xs"
            type="button"
            variant="quiet"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            aria-label="Clear estimate"
            className="-ml-1"
            onClick={() => onChange(null)}
            size="icon-xs"
            type="button"
            variant="quiet"
          >
            <X className="h-3 w-3" />
          </Button>
        </>
      ) : null}
    </div>
  );
}

function TitleField({
  value,
  onChange,
  onCommit,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  // Re-fit whenever the value changes (typing, or switching tasks).
  useEffect(resize, [value]);
  return (
    <Textarea
      className="resize-none overflow-hidden text-xl leading-snug font-semibold disabled:cursor-default disabled:opacity-100"
      disabled={disabled}
      onBlur={onCommit}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      ref={ref}
      rows={1}
      value={value}
      variant="bare"
    />
  );
}

function CopyLinkButton({ taskId }: { taskId: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <Button
      aria-label="Copy link to this task"
      className="absolute top-2.5 right-11 z-10"
      onClick={() => {
        copyTaskLink(taskId);
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      }}
      size="icon-sm"
      title={copied ? "Copied" : "Copy link"}
      type="button"
      variant="quiet"
    >
      {copied ? (
        <Check className="text-success h-4 w-4" />
      ) : (
        <Link2 className="h-4 w-4" />
      )}
    </Button>
  );
}

function StatusMenu({
  value,
  columns,
  onChange,
  canWrite,
}: {
  value: string;
  columns: ColumnRow[];
  onChange: (columnId: string) => void;
  canWrite: boolean;
}) {
  const current = columns.find((c) => c.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={PROP_CLS}
          size="md"
          variant="property"
          disabled={!canWrite}
          type="button"
        >
          <SquareKanban className="h-4 w-4 shrink-0 text-white/70" />
          <span className={cn("truncate", !current && PROP_PLACEHOLDER)}>
            {current ? current.name : "No status"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {columns.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => onChange(c.id)}>
            <SquareKanban className="h-3.5 w-3.5 text-white/40" />
            {c.name}
            {value === c.id ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// plain rows inside the label popover; must not close the menu on click
function MenuRow({
  muted,
  onClick,
  children,
}: {
  muted?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      className="w-full justify-start"
      onClick={onClick}
      size="md"
      variant={muted ? "property" : "ghost"}
    >
      {children}
    </Button>
  );
}

function LabelsPicker({
  boardId,
  taskId,
  labels,
  activeLabelIds,
  canWrite,
}: {
  boardId: string;
  taskId: string;
  labels: LabelRow[];
  activeLabelIds: Set<string>;
  canWrite: boolean;
}) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [managing, setManaging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);
  const toggle = api.label.setOnTask.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
  });
  const create = api.label.create.useMutation({
    onSuccess: async (row) => {
      if (row) {
        toggle.mutate({
          boardId,
          taskId,
          labelId: row.id,
          on: true,
        });
      }
      setQuery("");
      await utils.board.get.invalidate({ boardId });
    },
  });

  const active = labels.filter((l) => activeLabelIds.has(l.id));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? labels.filter((l) => l.name.toLowerCase().includes(q))
    : labels;
  const canCreate =
    q.length > 0 && !labels.some((l) => l.name.toLowerCase() === q);

  const createLabel = () => {
    if (!canCreate) return;
    create.mutate({ boardId, name: query.trim(), color: pickColor() });
  };

  return (
    <>
      <DropdownMenu onOpenChange={setOpen} open={open}>
        <DropdownMenuTrigger asChild>
          <Button
            className="h-auto min-h-8 max-w-full flex-wrap gap-x-2.5 gap-y-1 py-1"
            disabled={!canWrite}
            size="md"
            type="button"
            variant="property"
          >
            {active.length > 0 ? (
              active.map((l) => (
                <span className="inline-flex items-center gap-1.5" key={l.id}>
                  <Dot color={l.color} />
                  {l.name}
                </span>
              ))
            ) : (
              <>
                <Tag className={PROP_ICON} />
                <span className={PROP_PLACEHOLDER}>Label</span>
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56 p-0"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="border-b border-white/10 p-1.5">
            <Input
              className="h-7 text-xs"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  createLabel();
                }
              }}
              placeholder="Search or create…"
              ref={inputRef}
              value={query}
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.map((l) => {
              const on = activeLabelIds.has(l.id);
              return (
                <MenuRow
                  key={l.id}
                  onClick={() =>
                    toggle.mutate({ boardId, taskId, labelId: l.id, on: !on })
                  }
                >
                  <Dot color={l.color} size="lg" />
                  <span className="flex-1 truncate">{l.name}</span>
                  {on ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </MenuRow>
              );
            })}
            {canCreate ? (
              <MenuRow muted onClick={createLabel}>
                <Plus className="h-3.5 w-3.5 shrink-0" />
                Create “{query.trim()}”
              </MenuRow>
            ) : null}
            {filtered.length === 0 && !canCreate ? (
              <p className="px-2 py-1.5 text-xs text-white/40">
                No labels yet.
              </p>
            ) : null}
          </div>
          <div className="border-t border-white/10 p-1">
            <MenuRow
              muted
              onClick={() => {
                setOpen(false);
                setManaging(true);
              }}
            >
              <Settings2 className="h-3.5 w-3.5 shrink-0" /> Manage labels
            </MenuRow>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <ManageLabelsDialog
        boardId={boardId}
        labels={labels}
        onOpenChange={setManaging}
        open={managing}
      />
    </>
  );
}

// Dev-handoff helper: compose a structured branch name and copy the
// fetch → sync main → branch command block for starting work on this task.
function BranchMenu({
  task,
  labelNames,
}: {
  task: TaskRow;
  labelNames: string[];
}) {
  const [type, setType] = useState<BranchType>(() =>
    defaultBranchType(labelNames),
  );
  const branchArgs = {
    number: task.number,
    title: task.title,
    type,
  };
  const branch = buildBranchName(branchArgs);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={PROP_CLS} size="md" variant="property" type="button">
          <GitBranch className={PROP_ICON} />
          <span className="truncate">Branch</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <div className="px-2 pt-1.5 pb-2">
          <SectionLabel as="p">Branch name</SectionLabel>
          <p className="mt-1 font-mono text-xs break-all text-white">
            {branch}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {BRANCH_TYPES.map((t) => (
              <button
                className={cn(
                  segmentVariants({ size: "2xs", active: t === type }),
                  "font-mono",
                )}
                key={t}
                onClick={() => setType(t)}
                type="button"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => copyBranchCommand(branchArgs)}>
          <Copy className="h-3.5 w-3.5" /> Copy git commands
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copyBranchName(branchArgs)}>
          <GitBranch className="h-3.5 w-3.5" /> Copy branch name
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Personal, per-user — not a board write, so no canWrite gate.
function TodayToggle({ taskId }: { taskId: string }) {
  const utils = api.useUtils();
  const ids = api.today.ids.useQuery();
  const onToday = ids.data?.includes(taskId) ?? false;

  const invalidate = () => {
    void utils.today.ids.invalidate();
    void utils.today.list.invalidate();
  };

  const add = api.today.add.useMutation({
    onMutate: async () => {
      await utils.today.ids.cancel();
      const previous = utils.today.ids.getData();
      utils.today.ids.setData(undefined, (old) => [...(old ?? []), taskId]);
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) utils.today.ids.setData(undefined, ctx.previous);
      toast.error(e.message);
    },
    onSettled: invalidate,
  });
  const remove = api.today.remove.useMutation({
    onMutate: async () => {
      await utils.today.ids.cancel();
      const previous = utils.today.ids.getData();
      utils.today.ids.setData(undefined, (old) =>
        old?.filter((id) => id !== taskId),
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) utils.today.ids.setData(undefined, ctx.previous);
      toast.error(e.message);
    },
    onSettled: invalidate,
  });

  return (
    <Button
      className={PROP_CLS}
      size="md"
      variant="property"
      onClick={() =>
        onToday ? remove.mutate({ taskId }) : add.mutate({ taskId })
      }
      type="button"
    >
      <Sun
        className={cn(PROP_ICON, onToday && "text-warning")}
        fill={onToday ? "currentColor" : "none"}
      />
      <span className={cn(!onToday && PROP_PLACEHOLDER)}>
        {onToday ? "On today" : "Add to today"}
      </span>
    </Button>
  );
}

function pickColor() {
  return LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)]!;
}

function ManageLabelsDialog({
  boardId,
  labels,
  open,
  onOpenChange,
}: {
  boardId: string;
  labels: LabelRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage labels</DialogTitle>
          <DialogDescription>
            Rename, recolor, or delete labels. Changes apply across the board.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {labels.length === 0 ? (
            <p className="text-sm text-white/40">No labels yet.</p>
          ) : (
            labels.map((l) => (
              <ManageLabelRow boardId={boardId} key={l.id} label={l} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManageLabelRow({
  boardId,
  label: l,
}: {
  boardId: string;
  label: LabelRow;
}) {
  const utils = api.useUtils();
  const [name, setName] = useState(l.name);
  const update = api.label.update.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
    onError: (e) => toast.error(e.message),
  });
  const remove = api.label.delete.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
    onError: (e) => toast.error(e.message),
  });

  const saveName = () => {
    const next = name.trim();
    if (next && next !== l.name) {
      update.mutate({ boardId, labelId: l.id, name: next });
    } else {
      setName(l.name);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {LABEL_COLORS.map((c) => (
          <Swatch
            aria-label={`Set color ${c}`}
            className="size-4"
            color={c}
            key={c}
            onClick={() => update.mutate({ boardId, labelId: l.id, color: c })}
            selected={l.color === c}
          />
        ))}
      </div>
      <Input
        className="h-7 flex-1 text-sm"
        onBlur={saveName}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        value={name}
      />
      <Button
        aria-label="Delete label"
        onClick={() => {
          if (window.confirm(`Delete label "${l.name}"?`)) {
            remove.mutate({ boardId, labelId: l.id });
          }
        }}
        size="icon-sm"
        type="button"
        variant="quiet"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ChecklistPanel({
  boardId,
  taskId,
  canWrite,
}: {
  boardId: string;
  taskId: string;
  canWrite: boolean;
}) {
  const utils = api.useUtils();
  const list = api.checklist.list.useQuery({ boardId, taskId });
  const [text, setText] = useState("");
  const add = api.checklist.add.useMutation({
    onSuccess: async () => {
      setText("");
      await utils.checklist.list.invalidate({ boardId, taskId });
    },
  });
  const toggle = api.checklist.toggle.useMutation({
    onSuccess: () => utils.checklist.list.invalidate({ boardId, taskId }),
  });
  const remove = api.checklist.remove.useMutation({
    onSuccess: () => utils.checklist.list.invalidate({ boardId, taskId }),
  });

  return (
    <div className="flex flex-col gap-2">
      <Label>Checklist</Label>
      <ul className="flex flex-col gap-1">
        {(list.data ?? []).map((it) => (
          <li className="group flex items-center gap-2" key={it.id}>
            <Checkbox
              aria-label={it.text}
              checked={it.done}
              disabled={!canWrite}
              onCheckedChange={(done) =>
                toggle.mutate({ boardId, itemId: it.id, done })
              }
            />
            <span
              className={cn(
                "flex-1 text-sm",
                it.done && "text-white/40 line-through",
              )}
            >
              {it.text}
            </span>
            {canWrite ? (
              <Button
                className="opacity-0 group-hover:opacity-100"
                onClick={() => remove.mutate({ boardId, itemId: it.id })}
                size="icon-xs"
                type="button"
                variant="quiet"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {canWrite ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            add.mutate({ boardId, taskId, text: text.trim() });
          }}
        >
          <Input
            onChange={(e) => setText(e.target.value)}
            placeholder="Add item"
            value={text}
          />
          <Button size="sm" type="submit">
            Add
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function AttachmentsPanel({
  boardId,
  taskId,
  canWrite,
}: {
  boardId: string;
  taskId: string;
  canWrite: boolean;
}) {
  const utils = api.useUtils();
  const list = api.attachment.list.useQuery({ boardId, taskId });
  const createUrl = api.attachment.createUploadUrl.useMutation();
  const create = api.attachment.create.useMutation({
    onSuccess: () => utils.attachment.list.invalidate({ boardId, taskId }),
  });
  const remove = api.attachment.remove.useMutation({
    onSuccess: () => utils.attachment.list.invalidate({ boardId, taskId }),
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  async function onFileChosen(file: File) {
    const localId = crypto.randomUUID();
    const mime = file.type || "application/octet-stream";
    const previewUrl = mime.startsWith("image/")
      ? URL.createObjectURL(file)
      : null;
    setPending((p) => [
      ...p,
      { id: localId, filename: file.name, mime, previewUrl },
    ]);
    try {
      const { key, uploadUrl } = await createUrl.mutateAsync({
        boardId,
        taskId,
        filename: file.name,
        mime,
        sizeBytes: file.size,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed");
      await create.mutateAsync({
        boardId,
        taskId,
        key,
        filename: file.name,
        mime,
        sizeBytes: file.size,
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPending((p) => p.filter((u) => u.id !== localId));
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const items = list.data ?? [];
  const images = items.filter((a) => a.mime.startsWith("image/"));
  const files = items.filter((a) => !a.mime.startsWith("image/"));
  const pendingImages = pending.filter((p) => p.mime.startsWith("image/"));
  const pendingFiles = pending.filter((p) => !p.mime.startsWith("image/"));
  const busy = pending.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <Label>Attachments</Label>
      {images.length > 0 || pendingImages.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {images.map((a, i) => (
            <div
              className="group relative overflow-hidden rounded-md border border-white/10 bg-white/5"
              key={a.id}
            >
              <button
                className="block w-full"
                onClick={() => setViewerIndex(i)}
                type="button"
              >
                <img
                  alt={a.filename}
                  className="aspect-square w-full object-cover transition group-hover:brightness-110"
                  src={a.url}
                />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 opacity-0 transition group-hover:opacity-100">
                <span className="text-2xs truncate text-white">
                  {a.filename}
                </span>
                {canWrite ? (
                  <Button
                    aria-label="Remove attachment"
                    onClick={() =>
                      remove.mutate({ boardId, attachmentId: a.id })
                    }
                    size="icon-xs"
                    type="button"
                    variant="quiet"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {pendingImages.map((p) => (
            <div
              className="relative overflow-hidden rounded-md border border-white/10 bg-white/5"
              key={p.id}
            >
              {p.previewUrl ? (
                <img
                  alt={p.filename}
                  className="aspect-square w-full object-cover opacity-40"
                  src={p.previewUrl}
                />
              ) : (
                <div className="aspect-square w-full" />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <ul className="flex flex-col gap-1 text-sm">
        {files.map((a) => (
          <li className="flex items-center gap-2" key={a.id}>
            <Paperclip className="h-3.5 w-3.5 text-white/40" />
            <a
              className="flex-1 truncate text-white hover:underline"
              href={a.url}
              rel="noreferrer"
              target="_blank"
            >
              {a.filename}
            </a>
            <span className="text-xs text-white/40">
              {formatBytes(a.sizeBytes)}
            </span>
            {canWrite ? (
              <Button
                onClick={() => remove.mutate({ boardId, attachmentId: a.id })}
                size="icon-xs"
                type="button"
                variant="quiet"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </li>
        ))}
        {pendingFiles.map((p) => (
          <li className="flex items-center gap-2 text-white/70" key={p.id}>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
            <span className="flex-1 truncate">{p.filename}</span>
            <span className="text-xs text-white/40">Uploading…</span>
          </li>
        ))}
      </ul>
      {canWrite ? (
        <div>
          <input
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileChosen(f);
            }}
            ref={inputRef}
            type="file"
          />
          <Button
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            size="sm"
            variant="outline"
          >
            <Paperclip className="h-4 w-4" />
            {busy ? "Uploading…" : "Attach file"}
          </Button>
        </div>
      ) : null}
      <ImageLightbox
        images={images}
        index={viewerIndex}
        onChange={setViewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </div>
  );
}

type ImageItem = {
  id: string;
  url: string;
  filename: string;
};

function ImageLightbox({
  images,
  index,
  onChange,
  onClose,
}: {
  images: ImageItem[];
  index: number | null;
  onChange: (i: number) => void;
  onClose: () => void;
}) {
  const current = index !== null ? images[index] : null;
  return (
    <Dialog
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      open={current !== null && current !== undefined}
    >
      <DialogContent size="fullscreen">
        <DialogTitle className="sr-only">
          {current?.filename ?? "Image"}
        </DialogTitle>
        <div
          className="flex min-h-0 flex-1 items-center justify-center p-6"
          onClick={onClose}
        >
          {current ? (
            <img
              alt={current.filename}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
              src={current.url}
            />
          ) : null}
        </div>
        {images.length > 1 ? (
          <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 p-3">
            {images.map((img, i) => (
              <button
                className={cn(
                  "h-16 w-16 shrink-0 overflow-hidden rounded-md border transition",
                  i === index
                    ? "border-white"
                    : "border-white/10 opacity-70 hover:opacity-100",
                )}
                key={img.id}
                onClick={() => onChange(i)}
                type="button"
              >
                <img
                  alt={img.filename}
                  className="h-full w-full object-cover"
                  src={img.url}
                />
              </button>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function CommentsPanel({
  boardId,
  taskId,
  canWrite,
  mentions,
  tickets,
}: {
  boardId: string;
  taskId: string;
  canWrite: boolean;
  mentions: MentionItem[];
  tickets: TicketMentionItem[];
}) {
  const utils = api.useUtils();
  const me = api.user.me.useQuery();
  const list = api.comment.list.useQuery({ boardId, taskId });
  const [body, setBody] = useState("");
  const create = api.comment.create.useMutation({
    onSuccess: async () => {
      setBody("");
      await utils.comment.list.invalidate({ boardId, taskId });
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <Label>Comments</Label>
      <ul className="flex flex-col gap-3 text-sm">
        {(list.data ?? []).map((c) => (
          <CommentItem
            boardId={boardId}
            canManage={canWrite && me.data?.id === c.authorId}
            comment={c}
            key={c.id}
            mentions={mentions}
            taskId={taskId}
            tickets={tickets}
          />
        ))}
      </ul>
      {canWrite ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (isRichTextEmpty(body)) return;
            create.mutate({ boardId, taskId, body });
          }}
        >
          <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
            <RichTextEditor
              mentions={mentions}
              tickets={tickets}
              minHeight="44px"
              onChange={setBody}
              placeholder="Leave a comment…"
              value={body}
            />
          </div>
          <div className="flex justify-end">
            <Button
              disabled={isRichTextEmpty(body) || create.isPending}
              size="sm"
              type="submit"
            >
              Comment
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function CommentItem({
  comment: c,
  boardId,
  taskId,
  canManage,
  mentions,
  tickets,
}: {
  comment: RouterOutputs["comment"]["list"][number];
  boardId: string;
  taskId: string;
  canManage: boolean;
  mentions: MentionItem[];
  tickets: TicketMentionItem[];
}) {
  const utils = api.useUtils();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);

  const edit = api.comment.edit.useMutation({
    onSuccess: async () => {
      setEditing(false);
      await utils.comment.list.invalidate({ boardId, taskId });
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = api.comment.delete.useMutation({
    onSuccess: () => utils.comment.list.invalidate({ boardId, taskId }),
    onError: (e) => toast.error(e.message),
  });

  return (
    <li className="group flex gap-2">
      <UserAvatar image={c.authorImage} name={c.authorName} size={24} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="font-medium text-white">{c.authorName}</span>
          <span title={formatDateTime(c.createdAt)}>
            {formatRelative(c.createdAt)}
          </span>
          {c.editedAt ? <span className="text-white/40">(edited)</span> : null}
          {canManage && !editing ? (
            <div className="ml-auto flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
              <Button
                aria-label="Edit comment"
                onClick={() => {
                  setDraft(c.body);
                  setEditing(true);
                }}
                size="icon-xs"
                type="button"
                variant="quiet"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                aria-label="Delete comment"
                onClick={() => {
                  if (window.confirm("Delete this comment?")) {
                    remove.mutate({ boardId, commentId: c.id });
                  }
                }}
                size="icon-xs"
                type="button"
                variant="quiet"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (isRichTextEmpty(draft)) return;
              edit.mutate({ boardId, commentId: c.id, body: draft });
            }}
          >
            <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
              <RichTextEditor
                mentions={mentions}
                tickets={tickets}
                minHeight="44px"
                onChange={setDraft}
                placeholder="Edit comment…"
                value={draft}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setEditing(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={isRichTextEmpty(draft) || edit.isPending}
                size="sm"
                type="submit"
              >
                Save
              </Button>
            </div>
          </form>
        ) : (
          <RichTextContent
            mentions={mentions}
            tickets={tickets}
            value={c.body}
          />
        )}
      </div>
    </li>
  );
}

function ActivityPanel({
  boardId,
  taskId,
}: {
  boardId: string;
  taskId: string;
}) {
  const list = api.activity.list.useQuery({ boardId, taskId, limit: 50 });
  if (!list.data || list.data.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <Label>Activity</Label>
      <ul className="flex flex-col gap-1 text-sm">
        {list.data.map((a) => (
          <li
            className="flex items-center gap-2 text-xs text-white/70"
            key={a.id}
          >
            <UserAvatar image={a.actorImage} name={a.actorName} size={18} />
            <span className="font-medium text-white">{a.actorName}</span>
            <span>{formatVerb(a.verb)}</span>
            <span className="ml-auto" title={formatDateTime(a.createdAt)}>
              {formatRelative(a.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatVerb(verb: string) {
  switch (verb) {
    case "task.created":
      return "created this task";
    case "task.updated":
      return "updated the task";
    case "task.moved":
      return "moved the task";
    case "comment.created":
      return "commented";
    default:
      return verb;
  }
}
