"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  Tag,
  User as UserIcon,
  X,
} from "lucide-react";
import { formatDate } from "@kanbi/shared";
import { motion } from "motion/react";
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
type MemberRow = RouterOutputs["project"]["members"][number];
type DraftResponse = RouterOutputs["task"]["draftFromMessage"];
type Issue = DraftResponse["issues"][number];
type Variant = Issue["variants"][number];
type EditableVariant = Variant & { id: string };

type EditableIssue = {
  id: string;
  summary: string;
  confidence: "high" | "med" | "low";
  priority: Priority;
  labelIds: string[];
  assigneeId: string | null;
  dueAt: string | null;
  variantIndex: number;
  variants: EditableVariant[];
  skip: boolean;
};

const CONFIDENCE_META: Record<
  EditableIssue["confidence"],
  { label: string; short: string; dot: string; text: string }
> = {
  high: {
    label: "High confidence",
    short: "High",
    dot: "bg-emerald-400",
    text: "text-emerald-300/80",
  },
  med: {
    label: "Medium confidence",
    short: "Medium",
    dot: "bg-amber-400",
    text: "text-amber-300/80",
  },
  low: {
    label: "Low confidence",
    short: "Low",
    dot: "bg-white/40",
    text: "text-white/40",
  },
};

function formatDueLabel(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  // Build from parts so the YYYY-MM-DD value isn't shifted by timezone.
  return formatDate(new Date(y, m - 1, d));
}

/**
 * Animates its height to fit its content, so swapping content of a different
 * size (e.g. switching variants) glides instead of snapping. Overflow is only
 * clipped mid-animation so editor popovers aren't cut off while idle.
 */
function AnimateHeight({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const [overflow, setOverflow] = useState<"hidden" | "visible">("visible");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={{ height }}
      initial={false}
      onAnimationComplete={() => setOverflow("visible")}
      onAnimationStart={() => setOverflow("hidden")}
      style={{ overflow }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}

export function AiDraftDialog({
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
  const members = api.project.members.useQuery(
    { projectId },
    { enabled: open },
  );
  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns],
  );
  const defaultColumnId = initialColumnId ?? sortedColumns[0]?.id ?? null;

  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<EditableIssue[] | null>(null);
  // "input" shows the message editor; "review" shows the drafted cards. Kept
  // separate from `issues` so going Back to tweak the message never discards edits.
  const [view, setView] = useState<"input" | "review">("input");
  const [rawExpanded, setRawExpanded] = useState(false);
  const [columnId, setColumnId] = useState<string | null>(defaultColumnId);
  const [submitting, setSubmitting] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setMessage("");
      setIssues(null);
      setView("input");
      setRawExpanded(false);
      setColumnId(defaultColumnId);
      setTimeout(() => messageRef.current?.focus(), 30);
    }
  }, [open, defaultColumnId]);

  const draft = api.task.draftFromMessage.useMutation({
    onSuccess: (data) => {
      if (data.issues.length === 0) {
        toast.error("No actionable issues found in that message");
        return;
      }
      setIssues(
        data.issues.map((issue, idx) => {
          const id = `issue-${idx}-${issue.summary.slice(0, 20)}`;
          return {
            id,
            summary: issue.summary,
            confidence: issue.confidence,
            priority: issue.priority,
            labelIds: issue.labelIds,
            assigneeId: issue.assigneeId,
            dueAt: issue.dueAt,
            variantIndex: 0,
            variants: issue.variants.map((v, vi) => ({
              ...v,
              id: `${id}-v${vi}`,
            })),
            skip: false,
          };
        }),
      );
      setView("review");
    },
    onError: (err) => toast.error(err.message),
  });

  const createMany = api.task.createMany.useMutation();

  async function handleParse() {
    if (!message.trim() || draft.isPending) return;
    draft.mutate({ boardId, message: message.trim() });
  }

  async function handleCreate() {
    if (!issues || !columnId || submitting) return;
    const picked = issues
      .filter((i) => !i.skip)
      .map((i) => {
        const v = i.variants[i.variantIndex];
        if (!v) return null;
        return {
          columnId,
          title: v.title,
          description: v.description || undefined,
          priority: i.priority,
          labelIds: i.labelIds,
          assigneeId: i.assigneeId ?? undefined,
          dueAt: i.dueAt ? new Date(i.dueAt) : undefined,
          checklist: v.checklist.length > 0 ? v.checklist : undefined,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (picked.length === 0) {
      toast.error("Nothing to create — every issue is skipped");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createMany.mutateAsync({ boardId, tasks: picked });
      await utils.board.get.invalidate({ boardId });
      const col = sortedColumns.find((c) => c.id === columnId);
      toast.success(
        `${res.count} task${res.count === 1 ? "" : "s"} created${col ? ` in ${col.name}` : ""}`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function updateIssue(index: number, patch: Partial<EditableIssue>) {
    setIssues((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, ...patch };
      return next;
    });
  }

  function updateVariant(
    issueIndex: number,
    variantIndex: number,
    patch: Partial<EditableVariant>,
  ) {
    setIssues((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const issue = next[issueIndex];
      if (!issue) return prev;
      const variants = [...issue.variants];
      const v = variants[variantIndex];
      if (!v) return prev;
      variants[variantIndex] = { ...v, ...patch };
      next[issueIndex] = { ...issue, variants };
      return next;
    });
  }

  const activeCount = issues?.filter((i) => !i.skip).length ?? 0;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-0 p-0"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (view === "review") handleCreate();
            else handleParse();
          }
        }}
      >
        <DialogHeader className="border-b border-white/10 px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm text-white/80">
            <Sparkles className="h-4 w-4 text-white/60" />
            Draft tasks from a message
          </DialogTitle>
          <DialogDescription className="sr-only">
            Paste a client message and let AI suggest tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {view === "input" ? (
            <div className="flex flex-col gap-3 px-5 py-4">
              <Textarea
                autoFocus
                className="min-h-[180px] resize-y"
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Paste the client message, bug report, or spec here…"
                ref={messageRef}
                value={message}
              />
              {draft.isPending ? <SkeletonCards /> : null}
            </div>
          ) : (
            <>
              <RawPreview
                expanded={rawExpanded}
                message={message}
                onToggle={() => setRawExpanded((v) => !v)}
              />
              <div className="flex flex-col gap-3 px-5 py-4">
                {issues?.map((issue, i) => (
                  <IssueCard
                    issue={issue}
                    key={issue.id}
                    labels={labels}
                    members={members.data ?? []}
                    onIssueEdit={(patch) => updateIssue(i, patch)}
                    onSkip={(skip) => updateIssue(i, { skip })}
                    onVariantChange={(variantIndex) =>
                      updateIssue(i, { variantIndex })
                    }
                    onVariantEdit={(patch) =>
                      updateVariant(i, issue.variantIndex, patch)
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
          {view === "input" ? (
            <>
              <span className="text-[11px] text-white/40">
                AI extracts distinct issues, each with a priority, assignee, due
                date, labels, and a checklist.
              </span>
              <div className="flex items-center gap-2">
                {issues ? (
                  <Button
                    onClick={() => setView("review")}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Review drafts →
                  </Button>
                ) : null}
                <span className="hidden text-[11px] text-white/40 sm:block">
                  ⌘+↵ to draft
                </span>
                <Button
                  disabled={!message.trim() || draft.isPending}
                  onClick={handleParse}
                  size="sm"
                >
                  {draft.isPending
                    ? "Drafting…"
                    : issues
                      ? "Re-draft"
                      : "Draft tasks"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-white/70">
                <span>Create all in</span>
                <ColumnPicker
                  columns={sortedColumns}
                  onChange={setColumnId}
                  value={columnId}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setView("input")}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Back
                </Button>
                <span className="hidden text-[11px] text-white/40 sm:block">
                  ⌘+↵
                </span>
                <Button
                  disabled={activeCount === 0 || !columnId || submitting}
                  onClick={handleCreate}
                  size="sm"
                >
                  {submitting
                    ? "Creating…"
                    : `Create ${activeCount} task${activeCount === 1 ? "" : "s"}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-3">
      {["a", "b"].map((k) => (
        <div
          className="animate-pulse rounded-lg border border-white/10 bg-white/[0.02] p-4"
          key={k}
        >
          <div className="mb-3 h-3 w-2/3 rounded bg-white/10" />
          <div className="mb-2 h-3 w-1/2 rounded bg-white/10" />
          <div className="h-3 w-3/4 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function RawPreview({
  message,
  expanded,
  onToggle,
}: {
  message: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="flex items-start gap-2 border-b border-white/10 bg-white/[0.02] px-5 py-2 text-left text-xs text-white/50 transition hover:bg-white/[0.04]"
      onClick={onToggle}
      type="button"
    >
      {expanded ? (
        <ChevronUp className="mt-0.5 h-3 w-3 shrink-0" />
      ) : (
        <ChevronDown className="mt-0.5 h-3 w-3 shrink-0" />
      )}
      <span
        className={cn(
          "flex-1 whitespace-pre-wrap",
          expanded ? "" : "line-clamp-1",
        )}
      >
        {message}
      </span>
    </button>
  );
}

function IssueCard({
  issue,
  labels,
  members,
  onIssueEdit,
  onSkip,
  onVariantChange,
  onVariantEdit,
}: {
  issue: EditableIssue;
  labels: LabelRow[];
  members: MemberRow[];
  onIssueEdit: (patch: Partial<EditableIssue>) => void;
  onSkip: (skip: boolean) => void;
  onVariantChange: (index: number) => void;
  onVariantEdit: (patch: Partial<EditableVariant>) => void;
}) {
  const variant = issue.variants[issue.variantIndex];
  const meta = CONFIDENCE_META[issue.confidence];
  const selectedLabels = new Set(issue.labelIds);
  const multiVariant = issue.variants.length > 1;

  return (
    <div
      className={cn(
        "rounded-lg border bg-white/[0.02] transition",
        issue.skip
          ? "border-white/5 opacity-50"
          : "border-white/10 hover:border-white/20",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)}
          />
          <span
            className={cn(
              "shrink-0 text-[10px] font-medium tracking-wide uppercase",
              meta.text,
            )}
            title={meta.label}
          >
            {meta.short}
          </span>
          <span aria-hidden className="shrink-0 text-xs text-white/25">
            ·
          </span>
          <span className="truncate text-xs text-white/70">
            {issue.summary}
          </span>
        </div>
        <button
          className="shrink-0 text-[11px] text-white/50 transition hover:text-white/80"
          onClick={() => onSkip(!issue.skip)}
          type="button"
        >
          {issue.skip ? "Include" : "Skip"}
        </button>
      </div>

      {issue.skip || !variant ? null : (
        <>
          {/* Issue-level attributes — shared across every variant. */}
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">
            <PriorityChip
              onChange={(priority) => onIssueEdit({ priority })}
              value={issue.priority}
            />
            <AssigneeChip
              members={members}
              onChange={(assigneeId) => onIssueEdit({ assigneeId })}
              value={issue.assigneeId}
            />
            <DueDateChip
              onChange={(dueAt) => onIssueEdit({ dueAt })}
              value={issue.dueAt}
            />
            <LabelsChip
              labels={labels}
              onToggle={(id, on) => {
                const next = new Set(issue.labelIds);
                if (on) next.add(id);
                else next.delete(id);
                onIssueEdit({ labelIds: Array.from(next) });
              }}
              selected={selectedLabels}
            />
            {issue.labelIds.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {labels
                  .filter((l) => selectedLabels.has(l.id))
                  .map((l) => (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-black"
                      key={l.id}
                      style={{ background: l.color }}
                    >
                      {l.name}
                    </span>
                  ))}
              </div>
            ) : null}
          </div>

          {/* The divider marks the boundary: attributes above are issue-wide,
              the content below belongs to the selected variant. */}
          <div className="mx-4 border-t border-white/5" />

          {multiVariant ? (
            <div className="px-4 pt-3">
              <div className="inline-flex w-fit items-center gap-0.5 rounded-lg border border-white/10 bg-black/20 p-0.5">
                {issue.variants.map((v, i) => (
                  <button
                    className={cn(
                      "rounded-md px-3 py-1 text-[11px] font-medium transition",
                      i === issue.variantIndex
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-white/45 hover:text-white/80",
                    )}
                    key={v.id}
                    onClick={() => onVariantChange(i)}
                    type="button"
                  >
                    Variant {i + 1}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <AnimateHeight>
            <div
              className={cn(
                "flex flex-col gap-2.5 px-4 pb-3",
                multiVariant ? "pt-2.5" : "pt-3",
              )}
            >
              <Input
                className="border-0 bg-transparent px-0 text-sm font-medium focus-visible:ring-0"
                onChange={(e) => onVariantEdit({ title: e.target.value })}
                placeholder="Task title"
                value={variant.title}
              />
              <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
                <RichTextEditor
                  minHeight="60px"
                  onChange={(html) => onVariantEdit({ description: html })}
                  placeholder="Add context and acceptance criteria…"
                  value={variant.description}
                />
              </div>
              <ChecklistField
                items={variant.checklist}
                onChange={(checklist) => onVariantEdit({ checklist })}
              />
            </div>
          </AnimateHeight>
        </>
      )}
    </div>
  );
}

function PriorityChip({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70 capitalize transition hover:border-white/20 hover:text-white"
          type="button"
        >
          <PriorityIcon className="h-3 w-3" priority={value} />
          {value === "none" ? "Priority" : PRIORITY_META[value].label}
        </button>
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

function LabelsChip({
  labels,
  selected,
  onToggle,
}: {
  labels: LabelRow[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70 transition hover:border-white/20 hover:text-white"
          type="button"
        >
          <Tag className="h-3 w-3" />
          Labels
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {labels.length === 0 ? (
          <DropdownMenuItem disabled>No labels on this board</DropdownMenuItem>
        ) : (
          labels.map((l) => {
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
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AssigneeChip({
  value,
  members,
  onChange,
}: {
  value: string | null;
  members: MemberRow[];
  onChange: (id: string | null) => void;
}) {
  const current = members.find((m) => m.userId === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70 transition hover:border-white/20 hover:text-white"
          type="button"
        >
          {current ? (
            <UserAvatar image={current.image} name={current.name} size={14} />
          ) : (
            <UserIcon className="h-3 w-3" />
          )}
          {current ? current.name : "Assignee"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DueDateChip({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  return (
    <span className="relative inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] transition hover:border-white/20">
      <button
        className="inline-flex items-center gap-1.5 rounded-full py-1 pr-2 pl-2.5 text-[11px] text-white/70 transition hover:text-white"
        onClick={openPicker}
        type="button"
      >
        <CalendarDays className="h-3 w-3" />
        {value ? formatDueLabel(value) : "Due date"}
      </button>
      {value ? (
        <button
          aria-label="Clear due date"
          className="mr-1.5 rounded-full text-white/40 transition hover:text-white"
          onClick={() => onChange(null)}
          type="button"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
      <input
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-3 h-0 w-0 opacity-0"
        onChange={(e) => onChange(e.target.value || null)}
        ref={inputRef}
        tabIndex={-1}
        type="date"
        value={value ?? ""}
      />
    </span>
  );
}

function ChecklistField({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [text, setText] = useState("");

  function add() {
    const value = text.trim();
    if (!value) return;
    onChange([...items, value]);
    setText("");
  }

  if (items.length === 0 && text.length === 0) {
    return (
      <Input
        className="h-7 border-0 bg-transparent px-0 text-xs text-white/40 focus-visible:ring-0"
        onChange={(e) => setText(e.target.value)}
        placeholder="+ Add a checklist…"
        value={text}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border border-white/10 bg-white/[0.02] p-2.5">
      <div className="mb-0.5 px-0.5 text-[10px] font-medium tracking-wide text-white/40 uppercase">
        Checklist
      </div>
      {items.map((item, idx) => (
        <div className="group flex items-center gap-2.5" key={`${idx}-${item}`}>
          <span
            aria-hidden
            className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30"
          />
          <span className="flex-1 text-sm text-white/80">{item}</span>
          <button
            aria-label="Remove item"
            className="text-white/25 transition hover:text-white/80"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Plus className="h-3.5 w-3.5 shrink-0 text-white/30" />
        <Input
          autoFocus
          className="h-7 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a step, press Enter"
          value={text}
        />
      </div>
    </div>
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
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium text-white transition hover:bg-white/5"
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
