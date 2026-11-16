"use client";

import { formatDate, formatDateTime, formatRelative } from "@kanbi/shared";
import {
  CheckIcon,
  CopyIcon,
  EllipsisIcon,
  FileTextIcon,
  GitBranchIcon,
  HashIcon,
  Link2Icon,
  Maximize2Icon,
  MinusIcon,
  PanelRightIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  Settings2Icon,
  SquareKanbanIcon,
  SunIcon,
  TagIcon,
  TimerIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  isRichTextEmpty,
  RichTextContent,
  RichTextEditor,
} from "@/components/rich-text/editor";
import type {
  MentionItem,
  TicketMentionItem,
} from "@/components/rich-text/mention";
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
import {
  Drawer,
  DrawerClose,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectPrimitive,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { AgentBadge } from "@/components/agent-badge";
import { ImageLightbox } from "@/components/image-lightbox";
import { agentFromClientName } from "@/lib/agents";
import { UserAvatar } from "@/components/user-avatar";
import { ColorSwatchGroup } from "@/components/color-swatch-group";
import { extractFileIds } from "@/lib/file-url";
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
import { copyTaskLink, copyText } from "./copy-task-link";
import type { Priority } from "./priority";
import {
  AssigneePicker,
  DueDatePicker,
  LabelSwatch,
  LabelsCombobox,
  PriorityPicker,
  PropertyButton,
  PropertyText,
  propertyButton,
} from "./task-properties";
import { useUndoableBoardDelete } from "./use-undoable-board-delete";
import { useInlineImageUpload, useTaskUpload } from "./use-task-upload";

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

const toastError = (e: { message: string }) =>
  toastManager.add({ type: "error", title: e.message });

export function TaskDetailSheet({
  open,
  onOpenChange,
  onExpand,
  task,
  boardId,
  projectId,
  projectKey,
  projectSlug,
  columns,
  tasks,
  labels,
  taskLabels,
  canWrite,
  tickets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpand: (number: number) => void;
  task: TaskRow | null;
  boardId: string;
  projectId: string;
  projectKey: string;
  projectSlug: string;
  columns: ColumnRow[];
  tasks: TaskRow[];
  labels: LabelRow[];
  taskLabels: BoardData["taskLabels"];
  canWrite: boolean;
  tickets: TicketMentionItem[];
}) {
  return (
    <Drawer onOpenChange={onOpenChange} open={open} position="right">
      <DrawerPopup className="max-w-2xl">
        {task ? (
          <TaskDetail
            boardId={boardId}
            canWrite={canWrite}
            columns={columns}
            key={task.id}
            labels={labels}
            onClose={() => onOpenChange(false)}
            onToggleView={() => onExpand(task.number)}
            projectId={projectId}
            projectKey={projectKey}
            projectSlug={projectSlug}
            task={task}
            taskLabels={taskLabels.filter((tl) => tl.taskId === task.id)}
            tasks={tasks}
            tickets={tickets}
          />
        ) : null}
      </DrawerPopup>
    </Drawer>
  );
}

const SHEET_PARTS = {
  Header: DrawerHeader,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Panel: DrawerPanel,
};

type PartProps = React.ComponentProps<"div"> & { allowSelection?: boolean };
const PAGE_PARTS = {
  Header: ({ className, allowSelection: _, ...props }: PartProps) => (
    <div className={cn("flex flex-col gap-2 p-6 pb-3", className)} {...props} />
  ),
  Title: ({ className, ...props }: React.ComponentProps<"h1">) => (
    <h1
      className={cn("font-heading text-xl leading-none font-bold", className)}
      {...props}
    />
  ),
  Description: ({ className, ...props }: React.ComponentProps<"p">) => (
    <p className={cn("text-muted-foreground text-sm", className)} {...props} />
  ),
  Panel: ({ className, allowSelection: _, ...props }: PartProps) => (
    <div className={cn("p-6 pt-1", className)} {...props} />
  ),
};

export function TaskDetail({
  variant = "sheet",
  task,
  boardId,
  projectId,
  projectKey,
  projectSlug,
  columns,
  tasks,
  labels,
  taskLabels,
  canWrite,
  onClose,
  onToggleView,
  tickets,
}: {
  variant?: "sheet" | "page";
  task: TaskRow;
  boardId: string;
  projectId: string;
  projectKey: string;
  projectSlug: string;
  columns: ColumnRow[];
  tasks: TaskRow[];
  labels: LabelRow[];
  taskLabels: BoardData["taskLabels"];
  canWrite: boolean;
  onClose: () => void;
  onToggleView: () => void;
  tickets: TicketMentionItem[];
}) {
  const { Header, Title, Description, Panel } =
    variant === "page" ? PAGE_PARTS : SHEET_PARTS;
  const utils = api.useUtils();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const latestDescription = useRef(description);
  latestDescription.current = description;
  const uploadImage = useInlineImageUpload(boardId, task.id);

  const update = api.task.update.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
    onError: toastError,
  });
  const savedDescription = useRef(task.description ?? "");
  savedDescription.current = task.description ?? "";
  const saveDescription = () => {
    // blob: srcs = uploads still in flight; saved once they settle
    const html = latestDescription.current.replace(
      /<img\b[^>]*src="blob:[^"]*"[^>]*>/g,
      "",
    );
    if (html === savedDescription.current) return;
    savedDescription.current = html;
    update.mutate({ boardId, taskId: task.id, description: html || null });
  };
  const move = api.task.move.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
    onError: toastError,
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
  const activeLabelNames = labels
    .filter((l) => activeLabelIds.has(l.id))
    .map((l) => l.name);
  const identifier = `${projectKey}-${task.number}`;
  const updatedAt = task.updatedAt ?? task.createdAt;
  // empty optional props stay hidden until asked for; reset per task
  const [showDue, setShowDue] = useState(false);
  const [prevTaskId, setPrevTaskId] = useState(task.id);
  if (prevTaskId !== task.id) {
    setPrevTaskId(task.id);
    setShowDue(false);
  }
  const hasEstimate = task.estimatePomodoros != null;
  const hasDue = task.dueAt != null || showDue;
  // page = full navigation, nothing to animate -> render everything at once
  const ready = useAfterFirstPaint(variant === "sheet");

  return (
    <>
      <Header allowSelection className="gap-1 pe-4 pt-4">
        <div className="flex items-center gap-1">
          <CopyIdButton identifier={identifier} />
          <div className="ms-auto flex items-center gap-0.5">
            <TodayToggle taskId={task.id} />
            <CopyLinkButton number={task.number} projectSlug={projectSlug} />
            <ViewToggleButton onClick={onToggleView} variant={variant} />
            <TaskActionsMenu
              canWrite={canWrite}
              identifier={identifier}
              labelNames={activeLabelNames}
              projectSlug={projectSlug}
              onDelete={() =>
                void remove(
                  { kind: "task", id: task.id, name: task.title },
                  onClose,
                )
              }
              task={task}
            />
            {variant === "page" ? (
              <Button
                aria-label="Back to board"
                onClick={onClose}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            ) : (
              <DrawerClose
                render={
                  <Button aria-label="Close" size="icon-sm" variant="ghost" />
                }
              >
                <XIcon aria-hidden="true" />
              </DrawerClose>
            )}
          </div>
        </div>
        <Title>
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
        </Title>
        <Description className="text-xs">
          Updated{" "}
          <span title={formatDateTime(updatedAt)}>
            {formatRelative(updatedAt)}
          </span>
        </Description>
      </Header>

      <Panel className="flex flex-col gap-6">
        <dl className="flex flex-col gap-0.5">
          <PropertyRow label="Status">
            <StatusSelect
              canWrite={canWrite}
              columns={columns}
              onChange={changeColumn}
              value={task.columnId}
            />
          </PropertyRow>
          <PropertyRow label="Priority">
            <PriorityPicker
              disabled={!canWrite}
              onChange={(p) =>
                update.mutate({ boardId, taskId: task.id, priority: p })
              }
              size="row"
              value={task.priority as Priority}
            />
          </PropertyRow>
          <PropertyRow label="Assignee">
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
            {canWrite && !task.assigneeId && me.data ? (
              <Button
                className="text-muted-foreground"
                onClick={() =>
                  update.mutate({
                    boardId,
                    taskId: task.id,
                    assigneeId: me.data!.id,
                  })
                }
                size="xs"
                type="button"
                variant="ghost"
              >
                Assign to me
              </Button>
            ) : null}
          </PropertyRow>
          <PropertyRow label="Labels">
            <LabelsPicker
              activeLabelIds={activeLabelIds}
              boardId={boardId}
              canWrite={canWrite}
              labels={labels}
              taskId={task.id}
            />
          </PropertyRow>
          {hasDue ? (
            <PropertyRow label="Due">
              <DueControl
                canWrite={canWrite}
                defaultOpen={showDue && task.dueAt == null}
                onChange={(d) =>
                  update.mutate({ boardId, taskId: task.id, dueAt: d })
                }
                value={task.dueAt}
              />
            </PropertyRow>
          ) : null}
          {hasEstimate ? (
            <PropertyRow label="Estimate">
              <EstimateControl
                canWrite={canWrite}
                onChange={(n) =>
                  update.mutate({
                    boardId,
                    taskId: task.id,
                    estimatePomodoros: n,
                  })
                }
                value={task.estimatePomodoros}
              />
            </PropertyRow>
          ) : null}
          {canWrite && (!hasDue || !hasEstimate) ? (
            <div className="flex min-h-8 items-center gap-1 ps-24">
              {!hasDue ? (
                <Button
                  className="text-muted-foreground"
                  onClick={() => setShowDue(true)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <PlusIcon aria-hidden="true" />
                  Due date
                </Button>
              ) : null}
              {!hasEstimate ? (
                <Button
                  className="text-muted-foreground"
                  onClick={() =>
                    update.mutate({
                      boardId,
                      taskId: task.id,
                      estimatePomodoros: 1,
                    })
                  }
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <PlusIcon aria-hidden="true" />
                  Estimate
                </Button>
              ) : null}
            </div>
          ) : null}
        </dl>

        {ready ? (
          <>
            <Section title="Description">
              <RichTextEditor
                disabled={!canWrite}
                mentions={mentionItems}
                minHeight="40px"
                onBlur={saveDescription}
                onChange={(html) => {
                  latestDescription.current = html;
                  setDescription(html);
                }}
                // blur may have saved without the in-flight image
                onUploadingChange={(n) => {
                  if (n === 0) saveDescription();
                }}
                placeholder="Add a description…"
                tickets={tickets}
                uploadImage={canWrite ? uploadImage : undefined}
                value={description}
                variant="inline"
              />
            </Section>

            <LinkedDocsPanel boardId={boardId} taskId={task.id} />
            <ChecklistPanel
              boardId={boardId}
              canWrite={canWrite}
              taskId={task.id}
            />
            <AttachmentsPanel
              boardId={boardId}
              canWrite={canWrite}
              inlineIds={extractFileIds(task.description ?? "")}
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
          </>
        ) : (
          <BodySkeleton />
        )}
      </Panel>
    </>
  );
}

function TaskActionsMenu({
  task,
  identifier,
  labelNames,
  projectSlug,
  canWrite,
  onDelete,
}: {
  task: TaskRow;
  identifier: string;
  projectSlug: string;
  labelNames: string[];
  canWrite: boolean;
  onDelete: () => void;
}) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button aria-label="Task actions" size="icon-sm" variant="ghost" />
        }
      >
        <EllipsisIcon aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuItem onClick={() => void copyText(identifier, "ID copied")}>
          <HashIcon aria-hidden="true" />
          Copy ID
          <MenuShortcut>{MOD_KEY}.</MenuShortcut>
        </MenuItem>
        <MenuItem
          onClick={() =>
            void copyText(`${identifier} ${task.title}`, "ID and title copied")
          }
        >
          <CopyIcon aria-hidden="true" />
          Copy ID and title
        </MenuItem>
        <MenuItem onClick={() => void copyTaskLink(projectSlug, task.number)}>
          <Link2Icon aria-hidden="true" />
          Copy link
        </MenuItem>
        <BranchSubmenu labelNames={labelNames} task={task} />
        {canWrite ? (
          <>
            <MenuSeparator />
            {/* undo toast covers mistakes -> no confirm */}
            <MenuItem onClick={onDelete} variant="destructive">
              <Trash2Icon aria-hidden="true" />
              Delete task
            </MenuItem>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
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
    <Section title="Docs">
      <ul className="-mx-2 flex flex-col">
        {linked.data.map((document) => (
          <li key={document.id}>
            <Link
              className="hover:bg-accent focus-visible:ring-ring flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2"
              href={`/app/p/${document.projectSlug}/docs/${document.id}`}
            >
              <FileTextIcon
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
              />
              <span className="truncate">{document.title}</span>
              <span className="text-muted-foreground ms-auto shrink-0 text-xs">
                {formatRelative(document.updatedAt ?? document.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DueControl({
  value,
  onChange,
  canWrite,
  defaultOpen,
}: {
  value: Date | string | null;
  onChange: (d: Date | null) => void;
  canWrite: boolean;
  defaultOpen?: boolean;
}) {
  const has = value != null;
  return (
    <DueDatePicker
      defaultOpen={defaultOpen}
      disabled={!canWrite}
      label={has ? formatDate(value) : undefined}
      onChange={(v) => onChange(v ? new Date(v) : null)}
      size="row"
      value={has ? new Date(value).toISOString().slice(0, 10) : null}
    />
  );
}

// 25-min focus blocks; click label starts at 1, then +/-, X clears
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
    <div className="inline-flex items-center gap-0.5">
      {has && canWrite ? (
        <Button
          aria-label="Decrease estimate"
          onClick={dec}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <MinusIcon aria-hidden="true" />
        </Button>
      ) : null}
      <PropertyButton disabled={!canWrite} onClick={inc} type="button">
        <TimerIcon aria-hidden="true" />
        <PropertyText placeholder={!has}>
          {has ? `${value} × 25m` : "None"}
        </PropertyText>
      </PropertyButton>
      {has && canWrite ? (
        <>
          <Button
            aria-label="Increase estimate"
            onClick={inc}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <PlusIcon aria-hidden="true" />
          </Button>
          <Button
            aria-label="Clear estimate"
            onClick={() => onChange(null)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <XIcon aria-hidden="true" />
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
  return (
    <Textarea
      aria-label="Task title"
      // coss textarea = field-sizing-content; drop its min-height + padding for an inline title
      className="w-full rounded-md text-xl leading-snug font-semibold [&_textarea]:min-h-0 [&_textarea]:resize-none [&_textarea]:px-0 [&_textarea]:py-0 [&_textarea]:disabled:cursor-default"
      disabled={disabled}
      onBlur={onCommit}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      rows={1}
      unstyled
      value={value}
    />
  );
}

const MOD_KEY =
  typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform)
    ? "⌘"
    : "Ctrl+";

// plain button -> copies just the id; double-click select dragged in header newlines
function CopyIdButton({ identifier }: { identifier: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = () => {
    void copyText(identifier, "ID copied").then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    });
  };
  const copyRef = useRef(copy);
  copyRef.current = copy;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "." &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        copyRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            aria-label={`Copy ${identifier}`}
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring -ms-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-xs transition-colors outline-none focus-visible:ring-2"
            onClick={copy}
            type="button"
          />
        }
      >
        {identifier}
        {copied ? (
          <CheckIcon
            aria-hidden="true"
            className="text-success-foreground size-3"
          />
        ) : null}
      </TooltipTrigger>
      <TooltipPopup>{copied ? "Copied" : `Copy ID · ${MOD_KEY}.`}</TooltipPopup>
    </Tooltip>
  );
}

function ViewToggleButton({
  variant,
  onClick,
}: {
  variant: "sheet" | "page";
  onClick: () => void;
}) {
  const label = variant === "page" ? "Open in side sheet" : "Open as full page";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            onClick={onClick}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        {variant === "page" ? (
          <PanelRightIcon aria-hidden="true" />
        ) : (
          <Maximize2Icon aria-hidden="true" />
        )}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

function CopyLinkButton({
  projectSlug,
  number,
}: {
  projectSlug: string;
  number: number;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Copy link to this task"
            onClick={() => {
              copyTaskLink(projectSlug, number);
              setCopied(true);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setCopied(false), 1500);
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        {copied ? (
          <CheckIcon aria-hidden="true" className="text-success-foreground" />
        ) : (
          <Link2Icon aria-hidden="true" />
        )}
      </TooltipTrigger>
      <TooltipPopup>{copied ? "Copied" : "Copy link"}</TooltipPopup>
    </Tooltip>
  );
}

function StatusSelect({
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
  const items = columns.map((c) => ({ value: c.id, label: c.name }));
  const current = columns.find((c) => c.id === value);
  return (
    <Select
      disabled={!canWrite}
      items={items}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
      value={value}
    >
      <SelectPrimitive.Trigger
        aria-label="Status"
        render={propertyButton("row")}
      >
        <SquareKanbanIcon aria-hidden="true" />
        <PropertyText placeholder={!current}>
          {current ? current.name : "No status"}
        </PropertyText>
      </SelectPrimitive.Trigger>
      <SelectPopup alignItemWithTrigger={false}>
        {items.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
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
  const [managing, setManaging] = useState(false);
  const toggle = api.label.setOnTask.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
    onError: toastError,
  });
  const create = api.label.create.useMutation({
    onSuccess: async (row) => {
      if (row) {
        toggle.mutate({ boardId, taskId, labelId: row.id, on: true });
      }
      await utils.board.get.invalidate({ boardId });
    },
    onError: toastError,
  });

  const active = labels.filter((l) => activeLabelIds.has(l.id));

  return (
    <>
      <LabelsCombobox
        disabled={!canWrite}
        footer={
          <Button
            className="text-muted-foreground w-full justify-start"
            onClick={() => {
              setOpen(false);
              setManaging(true);
            }}
            size="sm"
            variant="ghost"
          >
            <Settings2Icon aria-hidden="true" />
            Manage labels
          </Button>
        }
        labels={labels}
        onCreate={(name) =>
          create.mutate({ boardId, name, color: pickColor() })
        }
        onOpenChange={setOpen}
        onToggle={(labelId, on) =>
          toggle.mutate({ boardId, taskId, labelId, on })
        }
        open={open}
        selected={activeLabelIds}
        trigger={
          <Button
            className="h-auto min-h-8 max-w-full flex-wrap justify-start gap-1 py-1 sm:min-h-7"
            size="sm"
            variant="ghost"
          >
            {active.length > 0 ? (
              active.map((l) => (
                <Badge key={l.id} variant="outline">
                  <LabelSwatch color={l.color} />
                  {l.name}
                </Badge>
              ))
            ) : (
              <>
                <TagIcon aria-hidden="true" />
                <PropertyText placeholder>None</PropertyText>
              </>
            )}
          </Button>
        }
      />
      <ManageLabelsDialog
        boardId={boardId}
        labels={labels}
        onOpenChange={setManaging}
        open={managing}
      />
    </>
  );
}

// compose a branch name + copy the fetch -> sync main -> branch command block
function BranchSubmenu({
  task,
  labelNames,
}: {
  task: TaskRow;
  labelNames: string[];
}) {
  const [type, setType] = useState<BranchType>(() =>
    defaultBranchType(labelNames),
  );
  const branchArgs = { number: task.number, title: task.title, type };
  const branch = buildBranchName(branchArgs);
  return (
    <MenuSub>
      <MenuSubTrigger>
        <GitBranchIcon aria-hidden="true" />
        Git branch
      </MenuSubTrigger>
      <MenuSubPopup className="w-72">
        <div className="px-2 pt-1.5 pb-2">
          <p className="text-muted-foreground text-xs font-medium">
            Branch name
          </p>
          <p className="text-foreground mt-1 font-mono text-xs break-all">
            {branch}
          </p>
        </div>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>Type</MenuGroupLabel>
          <MenuRadioGroup
            onValueChange={(v) => setType(v as BranchType)}
            value={type}
          >
            {BRANCH_TYPES.map((t) => (
              <MenuRadioItem
                className="font-mono"
                closeOnClick={false}
                key={t}
                value={t}
              >
                {t}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
        <MenuSeparator />
        <MenuItem onClick={() => copyBranchCommand(branchArgs)}>
          <CopyIcon aria-hidden="true" />
          Copy git commands
        </MenuItem>
        <MenuItem onClick={() => copyBranchName(branchArgs)}>
          <GitBranchIcon aria-hidden="true" />
          Copy branch name
        </MenuItem>
      </MenuSubPopup>
    </MenuSub>
  );
}

// personal, per-user -> not a board write, so no canWrite gate
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
      toastError(e);
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
      toastError(e);
    },
    onSettled: invalidate,
  });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={onToday ? "Remove from Today" : "Add to Today"}
            aria-pressed={onToday}
            onClick={() =>
              onToday ? remove.mutate({ taskId }) : add.mutate({ taskId })
            }
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <SunIcon
          aria-hidden="true"
          className={cn(onToday && "text-warning-foreground")}
          fill={onToday ? "currentColor" : "none"}
        />
      </TooltipTrigger>
      <TooltipPopup>{onToday ? "On Today" : "Add to Today"}</TooltipPopup>
    </Tooltip>
  );
}

const LABEL_SWATCHES = LABEL_COLORS.map((c) => ({
  value: c,
  label: `Color ${c}`,
  color: c,
}));

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
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage labels</DialogTitle>
          <DialogDescription>
            Rename, recolor, or delete labels. Changes apply across the board.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {labels.length === 0 ? (
            <p className="text-muted-foreground text-sm">No labels yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {labels.map((l) => (
                <ManageLabelRow boardId={boardId} key={l.id} label={l} />
              ))}
            </ul>
          )}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Done</DialogClose>
        </DialogFooter>
      </DialogPopup>
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
  const [confirming, setConfirming] = useState(false);
  const update = api.label.update.useMutation({
    onSuccess: () => utils.board.get.invalidate({ boardId }),
    onError: toastError,
  });
  const remove = api.label.delete.useMutation({
    onSuccess: async () => {
      setConfirming(false);
      await utils.board.get.invalidate({ boardId });
    },
    onError: toastError,
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
    <li className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Label name"
          className="flex-1"
          onBlur={saveName}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          size="sm"
          value={name}
        />
        <Button
          aria-label={`Delete label ${l.name}`}
          onClick={() => setConfirming(true)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2Icon aria-hidden="true" />
        </Button>
      </div>
      <ColorSwatchGroup
        aria-label={`Color for ${l.name}`}
        className="gap-1.5"
        itemClassName="size-5 sm:size-5"
        onValueChange={(c) =>
          update.mutate({ boardId, labelId: l.id, color: c })
        }
        options={LABEL_SWATCHES}
        value={l.color}
      />
      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{l.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The label is removed from every task on this board.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>
              Cancel
            </AlertDialogClose>
            <Button
              loading={remove.isPending}
              onClick={() => remove.mutate({ boardId, labelId: l.id })}
              variant="destructive"
            >
              Delete label
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </li>
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
    onError: toastError,
  });
  const toggle = api.checklist.toggle.useMutation({
    onSuccess: () => utils.checklist.list.invalidate({ boardId, taskId }),
    onError: toastError,
  });
  const remove = api.checklist.remove.useMutation({
    onSuccess: () => utils.checklist.list.invalidate({ boardId, taskId }),
    onError: toastError,
  });

  const items = list.data ?? [];
  const done = items.filter((it) => it.done).length;

  return (
    <Section
      meta={items.length > 0 ? `${done}/${items.length}` : undefined}
      title="Checklist"
    >
      {list.isPending ? <SectionSkeleton /> : null}
      {items.length > 0 ? (
        <ul className="-mx-2 flex flex-col">
          {items.map((it) => (
            <li
              className="group hover:bg-accent/50 flex min-h-8 items-center gap-2 rounded-md px-2"
              key={it.id}
            >
              <label className="flex flex-1 cursor-pointer items-center gap-2 py-1.5 text-sm">
                <Checkbox
                  checked={it.done}
                  disabled={!canWrite}
                  onCheckedChange={(next) =>
                    toggle.mutate({ boardId, itemId: it.id, done: next })
                  }
                />
                <span
                  className={cn(
                    it.done && "text-muted-foreground line-through",
                  )}
                >
                  {it.text}
                </span>
              </label>
              {canWrite ? (
                <Button
                  aria-label="Remove item"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                  onClick={() => remove.mutate({ boardId, itemId: it.id })}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
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
            aria-label="New checklist item"
            onChange={(e) => setText(e.target.value)}
            placeholder="Add item"
            size="sm"
            value={text}
          />
          <Button
            disabled={!text.trim()}
            loading={add.isPending}
            size="sm"
            type="submit"
            variant="outline"
          >
            Add
          </Button>
        </form>
      ) : null}
    </Section>
  );
}

function AttachmentsPanel({
  boardId,
  taskId,
  canWrite,
  inlineIds,
}: {
  boardId: string;
  taskId: string;
  canWrite: boolean;
  /** shown in the description already */
  inlineIds: string[];
}) {
  const utils = api.useUtils();
  const list = api.attachment.list.useQuery({ boardId, taskId });
  const uploadFile = useTaskUpload(boardId);
  const remove = api.attachment.remove.useMutation({
    onSuccess: () => utils.attachment.list.invalidate({ boardId, taskId }),
    onError: toastError,
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
      await uploadFile(taskId, file);
      await utils.attachment.list.invalidate({ boardId, taskId });
    } catch (err) {
      toastError(err as Error);
    } finally {
      setPending((p) => p.filter((u) => u.id !== localId));
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const items = (list.data ?? []).filter(
    (a) => !a.commentId && !inlineIds.includes(a.id),
  );
  const images = items.filter((a) => a.mime.startsWith("image/"));
  const files = items.filter((a) => !a.mime.startsWith("image/"));
  const pendingImages = pending.filter((p) => p.mime.startsWith("image/"));
  const pendingFiles = pending.filter((p) => !p.mime.startsWith("image/"));
  const busy = pending.length > 0;
  const hasImages = images.length > 0 || pendingImages.length > 0;
  const hasFiles = files.length > 0 || pendingFiles.length > 0;

  return (
    <Section
      action={
        canWrite ? (
          <>
            <input
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFileChosen(f);
              }}
              ref={inputRef}
              type="file"
            />
            <Button
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              size="xs"
              variant="ghost"
            >
              <PaperclipIcon aria-hidden="true" />
              {busy ? "Uploading…" : "Attach"}
            </Button>
          </>
        ) : null
      }
      title="Attachments"
    >
      {list.isPending ? (
        <SectionSkeleton />
      ) : hasImages || hasFiles ? (
        <Frame>
          {hasImages ? (
            <FramePanel className="grid grid-cols-3 gap-2 p-2">
              {images.map((a, i) => (
                <div
                  className="group bg-muted relative overflow-hidden rounded-lg border"
                  key={a.id}
                >
                  <button
                    aria-label={`View ${a.filename}`}
                    className="focus-visible:ring-ring block w-full outline-none focus-visible:ring-2"
                    onClick={() => setViewerIndex(i)}
                    type="button"
                  >
                    <img
                      alt={a.filename}
                      className="aspect-square w-full object-cover"
                      src={a.url}
                    />
                  </button>
                  {canWrite ? (
                    <Button
                      aria-label="Remove attachment"
                      className="bg-popover/80 absolute end-1 top-1 opacity-0 backdrop-blur-sm group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                      onClick={() =>
                        remove.mutate({ boardId, attachmentId: a.id })
                      }
                      size="icon-xs"
                      type="button"
                      variant="outline"
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              ))}
              {pendingImages.map((p) => (
                <div
                  className="bg-muted relative overflow-hidden rounded-lg border"
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
                    <Spinner />
                  </div>
                </div>
              ))}
            </FramePanel>
          ) : null}
          {hasFiles ? (
            <FramePanel className="p-1">
              <ul className="flex flex-col text-sm">
                {files.map((a) => (
                  <li
                    className="flex min-h-8 items-center gap-2 rounded-md px-2"
                    key={a.id}
                  >
                    <PaperclipIcon
                      aria-hidden="true"
                      className="text-muted-foreground size-4 shrink-0"
                    />
                    <a
                      className="flex-1 truncate hover:underline"
                      href={a.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {a.filename}
                    </a>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatBytes(a.sizeBytes)}
                    </span>
                    {canWrite ? (
                      <Button
                        aria-label={`Remove ${a.filename}`}
                        onClick={() =>
                          remove.mutate({ boardId, attachmentId: a.id })
                        }
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    ) : null}
                  </li>
                ))}
                {pendingFiles.map((p) => (
                  <li
                    className="text-muted-foreground flex min-h-8 items-center gap-2 px-2"
                    key={p.id}
                  >
                    <Spinner className="size-4" />
                    <span className="flex-1 truncate">{p.filename}</span>
                    <span className="text-xs">Uploading…</span>
                  </li>
                ))}
              </ul>
            </FramePanel>
          ) : null}
        </Frame>
      ) : (
        <p className="text-muted-foreground text-sm">No attachments.</p>
      )}
      <ImageLightbox
        images={images}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
      />
    </Section>
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
  const [uploading, setUploading] = useState(0);
  const uploadImage = useInlineImageUpload(boardId, taskId);
  const create = api.comment.create.useMutation({
    onSuccess: async () => {
      setBody("");
      await utils.comment.list.invalidate({ boardId, taskId });
    },
    onError: toastError,
  });
  const comments = list.data ?? [];

  return (
    <Section
      meta={comments.length > 0 ? String(comments.length) : undefined}
      title="Comments"
    >
      {list.isPending ? <SectionSkeleton /> : null}
      {comments.length > 0 ? (
        <ul className="flex flex-col gap-4 text-sm">
          {comments.map((c) => (
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
      ) : null}
      {canWrite ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (isRichTextEmpty(body) || uploading > 0) return;
            create.mutate({ boardId, taskId, body });
          }}
        >
          <RichTextEditor
            mentions={mentions}
            minHeight="44px"
            onChange={setBody}
            onUploadingChange={setUploading}
            placeholder="Leave a comment…"
            tickets={tickets}
            uploadImage={uploadImage}
            value={body}
          />
          <div className="flex justify-end gap-2">
            <Button
              disabled={isRichTextEmpty(body) || uploading > 0}
              loading={create.isPending}
              size="sm"
              type="submit"
            >
              Comment
            </Button>
          </div>
        </form>
      ) : null}
    </Section>
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
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [uploading, setUploading] = useState(0);
  const uploadImage = useInlineImageUpload(boardId, taskId);

  const edit = api.comment.edit.useMutation({
    onSuccess: async () => {
      setEditing(false);
      await utils.comment.list.invalidate({ boardId, taskId });
    },
    onError: toastError,
  });
  const remove = api.comment.delete.useMutation({
    onSuccess: async () => {
      setConfirming(false);
      await utils.comment.list.invalidate({ boardId, taskId });
    },
    onError: toastError,
  });

  return (
    <li className="group flex gap-3">
      <UserAvatar image={c.authorImage} name={c.authorName} size={28} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-muted-foreground flex min-h-6 items-center gap-2 text-xs">
          <span className="text-foreground text-sm font-medium">
            {c.authorName}
          </span>
          {c.agent ? (
            <AgentBadge
              agent={c.agent}
              tooltip={`Posted by an agent on ${c.authorName}'s behalf`}
            />
          ) : null}
          <span title={formatDateTime(c.createdAt)}>
            {formatRelative(c.createdAt)}
          </span>
          {c.editedAt ? <span>(edited)</span> : null}
          {canManage && !editing ? (
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    aria-label="Comment actions"
                    className="ms-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
                    size="icon-xs"
                    variant="ghost"
                  />
                }
              >
                <EllipsisIcon aria-hidden="true" />
              </MenuTrigger>
              <MenuPopup align="end">
                <MenuItem
                  onClick={() => {
                    setDraft(c.body);
                    setEditing(true);
                  }}
                >
                  <PencilIcon aria-hidden="true" />
                  Edit
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  onClick={() => setConfirming(true)}
                  variant="destructive"
                >
                  <Trash2Icon aria-hidden="true" />
                  Delete
                </MenuItem>
              </MenuPopup>
            </Menu>
          ) : null}
        </div>
        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (isRichTextEmpty(draft) || uploading > 0) return;
              edit.mutate({ boardId, commentId: c.id, body: draft });
            }}
          >
            <RichTextEditor
              mentions={mentions}
              minHeight="44px"
              onChange={setDraft}
              onUploadingChange={setUploading}
              placeholder="Edit comment…"
              tickets={tickets}
              uploadImage={uploadImage}
              value={draft}
            />
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
                disabled={isRichTextEmpty(draft) || uploading > 0}
                loading={edit.isPending}
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
      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>
              Cancel
            </AlertDialogClose>
            <Button
              loading={remove.isPending}
              onClick={() => remove.mutate({ boardId, commentId: c.id })}
              variant="destructive"
            >
              Delete comment
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
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
    <Section title="Activity">
      <ul className="flex flex-col gap-2">
        {list.data.map((a) => (
          <li
            className="text-muted-foreground flex items-center gap-2 text-xs"
            key={a.id}
          >
            <UserAvatar image={a.actorImage} name={a.actorName} size={18} />
            <span className="text-foreground font-medium">{a.actorName}</span>
            <span className="min-w-0 truncate">
              {formatVerb(a.verb, a.payload)}
            </span>
            {typeof a.payload?.agent === "string" ? (
              <AgentBadge
                // older rows have only the client name
                agent={
                  typeof a.payload.agentKind === "string"
                    ? a.payload.agentKind
                    : agentFromClientName(a.payload.agent)
                }
                tooltip={`Done via ${a.payload.agent} on ${a.actorName}'s behalf`}
              />
            ) : null}
            <span
              className="ms-auto shrink-0"
              title={formatDateTime(a.createdAt)}
            >
              {formatRelative(a.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function formatVerb(verb: string, payload: Record<string, unknown> | null) {
  switch (verb) {
    case "task.created":
      return "created this task";
    case "task.updated":
      return "updated the task";
    case "task.moved":
      return "moved the task";
    case "task.blocked":
      return "reported a blocker";
    case "comment.created":
      return "commented";
    case "attachment.added":
      return typeof payload?.filename === "string"
        ? `attached ${payload.filename}`
        : "added an attachment";
    default:
      return verb;
  }
}

// editors + panels are the slow mount; paint header/props first so the sheet opens instantly
function useAfterFirstPaint(defer: boolean) {
  const [ready, setReady] = useState(!defer);
  useEffect(() => {
    if (!defer) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() =>
        startTransition(() => setReady(true)),
      );
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [defer]);
  return ready;
}

function BodySkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      {["Description", "Checklist", "Comments"].map((title) => (
        <div className="flex flex-col gap-2" key={title}>
          <Skeleton className="h-4 w-24" />
          <SectionSkeleton />
        </div>
      ))}
    </div>
  );
}

// loading != empty; "No attachments." mid-fetch reads as data loss
function SectionSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 py-1">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

function Section({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-t pt-5">
      <div className="flex min-h-6 items-center gap-2">
        <h3 className="text-muted-foreground text-xs font-medium">{title}</h3>
        {meta ? (
          <span className="text-muted-foreground/72 text-xs tabular-nums">
            {meta}
          </span>
        ) : null}
        {action ? <div className="ms-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center">
      <dt className="text-muted-foreground w-24 shrink-0 text-sm">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">{children}</dd>
    </div>
  );
}
