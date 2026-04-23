"use client";

import { Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
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
type DraftResponse = RouterOutputs["task"]["draftFromMessage"];
type Issue = DraftResponse["issues"][number];
type Variant = Issue["variants"][number];
type EditableVariant = Variant & { id: string };

type EditableIssue = {
  id: string;
  summary: string;
  confidence: "high" | "med" | "low";
  variantIndex: number;
  variants: EditableVariant[];
  skip: boolean;
};

const CONFIDENCE_META: Record<
  EditableIssue["confidence"],
  { label: string; dot: string }
> = {
  high: { label: "High confidence", dot: "bg-emerald-400" },
  med: { label: "Medium confidence", dot: "bg-amber-400" },
  low: { label: "Low confidence", dot: "bg-white/40" },
};

export function AiDraftDialog({
  open,
  onOpenChange,
  boardId,
  columns,
  labels,
  initialColumnId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
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

  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<EditableIssue[] | null>(null);
  const [rawExpanded, setRawExpanded] = useState(false);
  const [columnId, setColumnId] = useState<string | null>(defaultColumnId);
  const [submitting, setSubmitting] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setMessage("");
      setIssues(null);
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
            variantIndex: 0,
            variants: issue.variants.map((v, vi) => ({
              ...v,
              id: `${id}-v${vi}`,
            })),
            skip: false,
          };
        }),
      );
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
          priority: v.priority,
          labelIds: v.labelIds,
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
            if (issues) handleCreate();
            else handleParse();
          }
        }}
      >
        <DialogHeader className="border-white/10 border-b px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm text-white/80">
            <Sparkles className="h-4 w-4 text-white/60" />
            Draft tasks from a message
          </DialogTitle>
          <DialogDescription className="sr-only">
            Paste a client message and let AI suggest tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {issues === null ? (
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
                {issues.map((issue, i) => (
                  <IssueCard
                    issue={issue}
                    key={issue.id}
                    labels={labels}
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

        <div className="flex items-center justify-between border-white/10 border-t px-5 py-3">
          {issues === null ? (
            <>
              <span className="text-[11px] text-white/40">
                AI will extract distinct issues with title, description, label,
                and priority.
              </span>
              <div className="flex items-center gap-2">
                <span className="hidden text-[11px] text-white/40 sm:block">
                  ⌘+↵ to draft
                </span>
                <Button
                  disabled={!message.trim() || draft.isPending}
                  onClick={handleParse}
                  size="sm"
                >
                  {draft.isPending ? "Drafting…" : "Draft tasks"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-white/70 text-xs">
                <span>Create in</span>
                <ColumnPicker
                  columns={sortedColumns}
                  onChange={setColumnId}
                  value={columnId}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIssues(null)}
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
      className="flex items-start gap-2 border-white/10 border-b bg-white/[0.02] px-5 py-2 text-left text-white/50 text-xs transition hover:bg-white/[0.04]"
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
  onSkip,
  onVariantChange,
  onVariantEdit,
}: {
  issue: EditableIssue;
  labels: LabelRow[];
  onSkip: (skip: boolean) => void;
  onVariantChange: (index: number) => void;
  onVariantEdit: (patch: Partial<EditableVariant>) => void;
}) {
  const variant = issue.variants[issue.variantIndex];
  const meta = CONFIDENCE_META[issue.confidence];
  const selectedLabels = new Set(variant?.labelIds ?? []);

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
            title={meta.label}
          />
          <span className="truncate text-white/70 text-xs">
            {issue.summary}
          </span>
        </div>
        <button
          className="text-[11px] text-white/50 transition hover:text-white/80"
          onClick={() => onSkip(!issue.skip)}
          type="button"
        >
          {issue.skip ? "Include" : "Skip"}
        </button>
      </div>

      {issue.skip || !variant ? null : (
        <>
          {issue.variants.length > 1 ? (
            <div className="flex items-center gap-1 px-4 pb-2">
              {issue.variants.map((v, i) => (
                <button
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] transition",
                    i === issue.variantIndex
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:bg-white/5 hover:text-white/80",
                  )}
                  key={v.id}
                  onClick={() => onVariantChange(i)}
                  type="button"
                >
                  Variant {i + 1}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 px-4 pb-3">
            <Input
              className="border-0 bg-transparent px-0 font-medium text-sm focus-visible:ring-0"
              onChange={(e) => onVariantEdit({ title: e.target.value })}
              placeholder="Task title"
              value={variant.title}
            />
            <Textarea
              className="min-h-[60px] text-xs"
              onChange={(e) => onVariantEdit({ description: e.target.value })}
              placeholder="Description (markdown supported)…"
              value={variant.description}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <PriorityChip
                onChange={(priority) => onVariantEdit({ priority })}
                value={variant.priority}
              />
              <LabelsChip
                labels={labels}
                onToggle={(id, on) => {
                  const next = new Set(variant.labelIds);
                  if (on) next.add(id);
                  else next.delete(id);
                  onVariantEdit({ labelIds: Array.from(next) });
                }}
                selected={selectedLabels}
              />
              {variant.labelIds.length > 0 ? (
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
          </div>
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
          {selected.size > 0
            ? `${selected.size} label${selected.size === 1 ? "" : "s"}`
            : "Labels"}
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
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-sm text-white transition hover:bg-white/5"
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
