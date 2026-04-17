"use client";

import {
  CalendarDays,
  Check,
  Flag,
  Loader2,
  Paperclip,
  Tag,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
type TaskRow = BoardData["tasks"][number];
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
  labels,
  taskLabels,
  canWrite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskRow | null;
  boardId: string;
  projectId: string;
  labels: LabelRow[];
  taskLabels: BoardData["taskLabels"];
  canWrite: boolean;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="overflow-y-auto">
        {task ? (
          <TaskDetail
            boardId={boardId}
            canWrite={canWrite}
            labels={labels}
            onClose={() => onOpenChange(false)}
            projectId={projectId}
            task={task}
            taskLabels={taskLabels.filter((tl) => tl.taskId === task.id)}
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
  labels,
  taskLabels,
  canWrite,
  onClose,
}: {
  task: TaskRow;
  boardId: string;
  projectId: string;
  labels: LabelRow[];
  taskLabels: BoardData["taskLabels"];
  canWrite: boolean;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");

  const update = api.task.update.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
    onError: (e) => toast.error(e.message),
  });
  const remove = api.task.delete.useMutation({
    onSuccess: async () => {
      onClose();
      await utils.board.get.invalidate({ boardId });
    },
  });
  const members = api.project.members.useQuery(
    { projectId },
    { enabled: canWrite },
  );

  const activeLabelIds = new Set(taskLabels.map((tl) => tl.labelId));

  return (
    <div className="flex flex-col gap-5">
      <SheetHeader>
        <SheetTitle>
          <Input
            className="border-0 bg-transparent px-0 text-lg focus-visible:ring-0"
            disabled={!canWrite}
            onBlur={() => {
              if (title.trim() && title !== task.title) {
                update.mutate({ boardId, taskId: task.id, title });
              }
            }}
            onChange={(e) => setTitle(e.target.value)}
            value={title}
          />
        </SheetTitle>
        <SheetDescription>
          Updated{" "}
          {task.updatedAt
            ? new Date(task.updatedAt).toLocaleString()
            : new Date(task.createdAt).toLocaleString()}
        </SheetDescription>
      </SheetHeader>

      <div className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
        <MetaLabel icon={<Flag className="h-3.5 w-3.5" />}>Priority</MetaLabel>
        <PriorityMenu
          canWrite={canWrite}
          onChange={(p) =>
            update.mutate({ boardId, taskId: task.id, priority: p })
          }
          value={task.priority as Priority}
        />

        <MetaLabel icon={<UserIcon className="h-3.5 w-3.5" />}>
          Assignee
        </MetaLabel>
        <AssigneeMenu
          canWrite={canWrite}
          members={members.data ?? []}
          onChange={(id) =>
            update.mutate({ boardId, taskId: task.id, assigneeId: id })
          }
          value={task.assigneeId}
        />

        <MetaLabel icon={<CalendarDays className="h-3.5 w-3.5" />}>
          Due
        </MetaLabel>
        <Input
          className="max-w-[200px]"
          disabled={!canWrite}
          onChange={(e) => {
            const v = e.target.value;
            update.mutate({
              boardId,
              taskId: task.id,
              dueAt: v ? new Date(v) : null,
            });
          }}
          type="date"
          value={
            task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : ""
          }
        />

        <MetaLabel icon={<Tag className="h-3.5 w-3.5" />}>Labels</MetaLabel>
        <LabelsPicker
          activeLabelIds={activeLabelIds}
          boardId={boardId}
          canWrite={canWrite}
          labels={labels}
          taskId={task.id}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Description</Label>
        <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
          <RichTextEditor
            disabled={!canWrite}
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

      <ChecklistPanel boardId={boardId} canWrite={canWrite} taskId={task.id} />
      <AttachmentsPanel
        boardId={boardId}
        canWrite={canWrite}
        taskId={task.id}
      />
      <CommentsPanel boardId={boardId} canWrite={canWrite} taskId={task.id} />
      <ActivityPanel boardId={boardId} taskId={task.id} />

      {canWrite ? (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => remove.mutate({ boardId, taskId: task.id })}
            variant="destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete task
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function MetaLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 pt-1.5 text-white/70 text-xs uppercase tracking-wide">
      {icon}
      {children}
    </div>
  );
}

function PriorityMenu({
  value,
  onChange,
  canWrite,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
  canWrite: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={!canWrite} size="sm" variant="outline">
          <PriorityIcon className="h-3.5 w-3.5" priority={value} />
          {PRIORITY_META[value].label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {PRIORITIES.map((p) => (
          <DropdownMenuItem key={p} onSelect={() => onChange(p)}>
            <PriorityIcon className="mr-2 h-3.5 w-3.5" priority={p} />
            {PRIORITY_META[p].label}
            {p === value ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssigneeMenu({
  value,
  members,
  onChange,
  canWrite,
}: {
  value: string | null;
  members: RouterOutputs["project"]["members"];
  onChange: (id: string | null) => void;
  canWrite: boolean;
}) {
  const current = members.find((m) => m.userId === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={!canWrite} size="sm" variant="outline">
          {current ? (
            <>
              <UserAvatar image={current.image} name={current.name} size={18} />
              {current.name}
            </>
          ) : (
            "Unassigned"
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => onChange(null)}>
          Unassigned
          {value === null ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
        </DropdownMenuItem>
        {members.map((m) => (
          <DropdownMenuItem key={m.userId} onSelect={() => onChange(m.userId)}>
            <UserAvatar image={m.image} name={m.name} size={18} />
            {m.name}
            {value === m.userId ? (
              <Check className="ml-auto h-3.5 w-3.5" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
  const [name, setName] = useState("");
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
      setName("");
      await utils.board.get.invalidate({ boardId });
    },
  });

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((l) => {
        const on = activeLabelIds.has(l.id);
        return (
          <button
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
              on
                ? "border-transparent text-black"
                : "border-white/10 text-white/70 hover:border-white/20",
            )}
            disabled={!canWrite}
            key={l.id}
            onClick={() =>
              toggle.mutate({
                boardId,
                taskId,
                labelId: l.id,
                on: !on,
              })
            }
            style={on ? { background: l.color } : undefined}
            type="button"
          >
            {l.name}
          </button>
        );
      })}
      {canWrite ? (
        <form
          className="inline-flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create.mutate({
              boardId,
              name: name.trim(),
              color: pickColor(),
            });
          }}
        >
          <Input
            className="h-6 w-24 text-xs"
            onChange={(e) => setName(e.target.value)}
            placeholder="+ new"
            value={name}
          />
        </form>
      ) : null}
    </div>
  );
}

function pickColor() {
  const palette = [
    "#f43f5e",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
  ];
  return palette[Math.floor(Math.random() * palette.length)]!;
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
            <input
              checked={it.done}
              className="accent-white"
              disabled={!canWrite}
              onChange={(e) =>
                toggle.mutate({
                  boardId,
                  itemId: it.id,
                  done: e.target.checked,
                })
              }
              type="checkbox"
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
              <button
                className="text-white/40 opacity-0 transition hover:text-white group-hover:opacity-100"
                onClick={() => remove.mutate({ boardId, itemId: it.id })}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
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
              className="group relative overflow-hidden rounded-md border border-white/10 bg-white/[0.04]"
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
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent px-2 pt-6 pb-1.5 opacity-0 transition group-hover:opacity-100">
                <span className="truncate text-[10px] text-white/80">
                  {a.filename}
                </span>
                {canWrite ? (
                  <button
                    aria-label="Remove attachment"
                    className="text-white/70 hover:text-white"
                    onClick={() =>
                      remove.mutate({ boardId, attachmentId: a.id })
                    }
                    type="button"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {pendingImages.map((p) => (
            <div
              className="relative overflow-hidden rounded-md border border-white/10 bg-white/[0.04]"
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
                <Loader2 className="h-5 w-5 animate-spin text-white/80" />
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
            <span className="text-white/40 text-xs">
              {formatBytes(a.sizeBytes)}
            </span>
            {canWrite ? (
              <button
                className="text-white/40 hover:text-white"
                onClick={() => remove.mutate({ boardId, attachmentId: a.id })}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </li>
        ))}
        {pendingFiles.map((p) => (
          <li className="flex items-center gap-2 text-white/60" key={p.id}>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
            <span className="flex-1 truncate">{p.filename}</span>
            <span className="text-white/40 text-xs">Uploading…</span>
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
      <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-black/95 p-0">
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
          <div className="flex shrink-0 gap-2 overflow-x-auto border-white/10 border-t p-3">
            {images.map((img, i) => (
              <button
                className={cn(
                  "h-16 w-16 shrink-0 overflow-hidden rounded-md border transition",
                  i === index
                    ? "border-white"
                    : "border-white/10 opacity-60 hover:opacity-100",
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
}: {
  boardId: string;
  taskId: string;
  canWrite: boolean;
}) {
  const utils = api.useUtils();
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
          <li className="flex gap-2" key={c.id}>
            <UserAvatar image={c.authorImage} name={c.authorName} size={24} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <span className="font-medium text-white/80">
                  {c.authorName}
                </span>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      {canWrite ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            create.mutate({ boardId, taskId, body: body.trim() });
          }}
        >
          <Textarea
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave a comment…"
            rows={2}
            value={body}
          />
          <div className="flex justify-end">
            <Button
              disabled={!body.trim() || create.isPending}
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
            className="flex items-center gap-2 text-white/70 text-xs"
            key={a.id}
          >
            <UserAvatar image={a.actorImage} name={a.actorName} size={18} />
            <span className="font-medium text-white/80">{a.actorName}</span>
            <span>{formatVerb(a.verb)}</span>
            <span className="ml-auto">
              {new Date(a.createdAt).toLocaleString()}
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
