"use client";

import {
  ChevronDownIcon,
  MinusIcon,
  PlusIcon,
  SparklesIcon,
  TimerIcon,
  XIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RichTextEditor } from "@/components/rich-text/editor";
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
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
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
  estimatePomodoros: number;
  variantIndex: number;
  variants: EditableVariant[];
  skip: boolean;
};

const CONFIDENCE_META: Record<
  EditableIssue["confidence"],
  { label: string; dot: string }
> = {
  high: { label: "High confidence", dot: "bg-success" },
  med: { label: "Medium confidence", dot: "bg-warning" },
  low: { label: "Low confidence", dot: "bg-muted-foreground/48" },
};

// keyed on explicit `kind` tag (not array position)
const VARIANT_LABELS: Record<Variant["kind"], string> = {
  concise: "Concise",
  medium: "Medium",
  verbose: "Verbose",
};

const toastError = (message: string) =>
  toastManager.add({ type: "error", title: message });

// glides height when swapping variants; overflow clipped only mid-animation
// so idle editor popovers aren't cut off
function AnimateHeight({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
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
      transition={{
        duration: reduceMotion ? 0 : 0.2,
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}

function ModEnter({ className }: { className?: string }) {
  return (
    <KbdGroup className={cn("max-sm:hidden", className)}>
      <Kbd className="bg-primary-foreground/16 text-primary-foreground">⌘</Kbd>
      <Kbd className="bg-primary-foreground/16 text-primary-foreground">↵</Kbd>
    </KbdGroup>
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
  // separate from `issues` so going back to tweak the message keeps edits
  const [view, setView] = useState<"input" | "review">("input");
  const [columnId, setColumnId] = useState<string | null>(defaultColumnId);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = message.trim().length > 0 || (issues?.length ?? 0) > 0;

  // guards esc/backdrop/x; successful create calls onOpenChange directly
  function requestOpenChange(next: boolean) {
    if (!next && isDirty) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  }

  useEffect(() => {
    if (open) {
      setMessage("");
      setIssues(null);
      setView("input");
      setColumnId(defaultColumnId);
      setConfirmDiscard(false);
    }
  }, [open, defaultColumnId]);

  const draft = api.task.draftFromMessage.useMutation({
    onSuccess: (data) => {
      if (data.issues.length === 0) {
        toastError("No actionable issues found in that message");
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
            estimatePomodoros: issue.estimatePomodoros,
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
    onError: (err) => toastError(err.message),
  });

  const createMany = api.task.createMany.useMutation();

  function handleParse() {
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
          estimatePomodoros: i.estimatePomodoros,
          checklist: v.checklist.length > 0 ? v.checklist : undefined,
          sourceText: message.trim(),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (picked.length === 0) {
      toastError("Nothing to create. Every issue is skipped.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createMany.mutateAsync({ boardId, tasks: picked });
      await utils.board.get.invalidate({ boardId });
      const col = sortedColumns.find((c) => c.id === columnId);
      toastManager.add({
        type: "success",
        title: `${res.count} task${res.count === 1 ? "" : "s"} created${col ? ` in ${col.name}` : ""}`,
      });
      onOpenChange(false);
    } catch (err) {
      toastError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function updateIssue(index: number, patch: Partial<EditableIssue>) {
    setIssues((prev) => {
      if (!prev) return prev;
      const current = prev[index];
      if (!current) return prev;
      const next = [...prev];
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
      const issue = prev[issueIndex];
      const v = issue?.variants[variantIndex];
      if (!issue || !v) return prev;
      const variants = [...issue.variants];
      variants[variantIndex] = { ...v, ...patch };
      const next = [...prev];
      next[issueIndex] = { ...issue, variants };
      return next;
    });
  }

  const activeCount = issues?.filter((i) => !i.skip).length ?? 0;

  return (
    <>
      <Dialog onOpenChange={requestOpenChange} open={open}>
        <DialogPopup
          className="max-w-3xl"
          initialFocus={messageRef}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (view === "review") void handleCreate();
              else handleParse();
            }
          }}
        >
          <DialogHeader className="flex-row items-center gap-2 pe-12 pb-3">
            <Badge className="bg-ai/8 text-ai-foreground dark:bg-ai/16">
              <SparklesIcon aria-hidden="true" />
              AI
            </Badge>
            <DialogTitle className="font-medium font-sans text-base">
              Draft tasks from a message
            </DialogTitle>
            <DialogDescription className="sr-only">
              Paste a client message and let AI suggest tasks.
            </DialogDescription>
          </DialogHeader>

          {view === "input" ? (
            <DialogPanel className="flex flex-col gap-4">
              <Field>
                <FieldLabel className="sr-only">Message</FieldLabel>
                <Textarea
                  className="[&_textarea]:max-h-[50vh] [&_textarea]:min-h-48 [&_textarea]:resize-y [&_textarea]:leading-relaxed"
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Paste the client message, bug report, or spec here…"
                  ref={messageRef}
                  value={message}
                />
                <FieldDescription>
                  Each issue comes with a priority, assignee, due date, labels,
                  a pomodoro estimate and a checklist.
                </FieldDescription>
              </Field>
              {draft.isPending ? <SkeletonCards /> : null}
            </DialogPanel>
          ) : (
            <DialogPanel className="flex flex-col gap-3">
              <RawPreview message={message} />
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
            </DialogPanel>
          )}

          <DialogFooter
            className={cn(
              "items-center",
              view === "review" && "sm:justify-between",
            )}
          >
            {view === "input" ? (
              <>
                <div className="flex items-center gap-2">
                  {issues ? (
                    <Button onClick={() => setView("review")} variant="ghost">
                      Review drafts
                    </Button>
                  ) : null}
                  <Button
                    disabled={!message.trim()}
                    loading={draft.isPending}
                    onClick={handleParse}
                  >
                    {issues ? "Re-draft" : "Draft tasks"}
                    <ModEnter />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                  Create all in
                  <ColumnPicker
                    columns={sortedColumns}
                    onChange={setColumnId}
                    value={columnId}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setView("input")} variant="ghost">
                    Back
                  </Button>
                  <Button
                    disabled={activeCount === 0 || !columnId}
                    loading={submitting}
                    onClick={handleCreate}
                  >
                    Create {activeCount} task{activeCount === 1 ? "" : "s"}
                    <ModEnter />
                  </Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <AlertDialog onOpenChange={setConfirmDiscard} open={confirmDiscard}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Your message{issues ? " and the tasks drafted from it" : ""} will
              be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>
              Keep editing
            </AlertDialogClose>
            <Button
              onClick={() => {
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
              variant="destructive"
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}

function SkeletonCards() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      {["a", "b"].map((k) => (
        <div className="flex flex-col gap-2.5 rounded-xl border p-4" key={k}>
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function RawPreview({ message }: { message: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger
        className="group/raw flex w-full items-start gap-2 rounded-lg px-1 py-1 text-start text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDownIcon
          aria-hidden="true"
          className="mt-0.5 size-3.5 shrink-0 transition-transform group-data-panel-open/raw:rotate-180"
        />
        <span className="line-clamp-1 flex-1 group-data-panel-open/raw:hidden">
          {message}
        </span>
        <span className="hidden group-data-panel-open/raw:inline">
          Original message
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <p className="whitespace-pre-wrap ps-6 pt-1 text-muted-foreground text-xs">
          {message}
        </p>
      </CollapsiblePanel>
    </Collapsible>
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
  const activeLabels = labels.filter((l) => selectedLabels.has(l.id));

  return (
    <section
      aria-label={issue.summary}
      className={cn(
        "rounded-xl border bg-card transition-opacity",
        issue.skip && "bg-transparent opacity-64",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Tooltip>
            <TooltipTrigger
              aria-label={meta.label}
              render={
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", meta.dot)}
                />
              }
            />
            <TooltipPopup>{meta.label}</TooltipPopup>
          </Tooltip>
          <span className="truncate font-medium text-sm">{issue.summary}</span>
        </div>
        <Button
          className="shrink-0 text-muted-foreground"
          onClick={() => onSkip(!issue.skip)}
          size="xs"
          variant="ghost"
        >
          {issue.skip ? "Include" : "Skip"}
        </Button>
      </div>

      {issue.skip || !variant ? null : (
        <>
          {/* issue-wide attrs; everything below the border is per-variant */}
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
            <PriorityPicker
              onChange={(priority) => onIssueEdit({ priority })}
              value={issue.priority}
            />
            <AssigneePicker
              members={members}
              onChange={(assigneeId) => onIssueEdit({ assigneeId })}
              value={issue.assigneeId}
            />
            <DueDatePicker
              onChange={(dueAt) => onIssueEdit({ dueAt })}
              value={issue.dueAt}
            />
            <EstimateChip
              onChange={(estimatePomodoros) =>
                onIssueEdit({ estimatePomodoros })
              }
              value={issue.estimatePomodoros}
            />
            <LabelsChip
              emptyText="No labels on this board"
              labels={labels}
              onToggle={(id, on) => {
                const next = new Set(issue.labelIds);
                if (on) next.add(id);
                else next.delete(id);
                onIssueEdit({ labelIds: Array.from(next) });
              }}
              selected={selectedLabels}
            />
            {activeLabels.length > 1
              ? activeLabels.map((l) => (
                  <Badge key={l.id} variant="outline">
                    <LabelSwatch color={l.color} />
                    {l.name}
                  </Badge>
                ))
              : null}
          </div>

          <div className="flex flex-col gap-2 border-t px-4 pt-3 pb-4">
            {issue.variants.length > 1 ? (
              <ToggleGroup
                aria-label="Detail level"
                className="self-start"
                onValueChange={(next) => {
                  const v = next[0] as string | undefined;
                  if (v !== undefined) onVariantChange(Number(v));
                }}
                size="sm"
                value={[String(issue.variantIndex)]}
                variant="outline"
              >
                {issue.variants.map((v, i) => (
                  <ToggleGroupItem key={v.id} value={String(i)}>
                    {VARIANT_LABELS[v.kind] ?? `Variant ${i + 1}`}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : null}

            <AnimateHeight>
              <div className="flex flex-col gap-1">
                <Input
                  aria-label="Task title"
                  className="[&_input]:h-auto [&_input]:px-0 [&_input]:py-1 [&_input]:font-medium [&_input]:text-base [&_input]:leading-snug"
                  onChange={(e) => onVariantEdit({ title: e.target.value })}
                  placeholder="Task title"
                  unstyled
                  value={variant.title}
                />
                <RichTextEditor
                  className="text-muted-foreground"
                  minHeight="52px"
                  onChange={(html) => onVariantEdit({ description: html })}
                  placeholder="Add context and acceptance criteria…"
                  value={variant.description}
                />
                <ChecklistField
                  items={variant.checklist}
                  onChange={(checklist) => onVariantEdit({ checklist })}
                />
              </div>
            </AnimateHeight>
          </div>
        </>
      )}
    </section>
  );
}

function EstimateChip({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <span className="inline-flex h-6 items-center gap-0.5 rounded-md border border-input px-0.5 text-xs">
      <Button
        aria-label="Decrease estimate"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        size="icon-xs"
        variant="ghost"
      >
        <MinusIcon aria-hidden="true" />
      </Button>
      <span className="inline-flex items-center gap-1 px-0.5 tabular-nums">
        <TimerIcon
          aria-hidden="true"
          className="size-3.5 text-muted-foreground"
        />
        <span className="sr-only">Estimate: </span>
        {value}
      </span>
      <Button
        aria-label="Increase estimate"
        disabled={value >= 8}
        onClick={() => onChange(Math.min(8, value + 1))}
        size="icon-xs"
        variant="ghost"
      >
        <PlusIcon aria-hidden="true" />
      </Button>
    </span>
  );
}

const CHECKLIST_INPUT =
  "flex-1 [&_input]:h-7 [&_input]:px-0 [&_input]:leading-7 sm:[&_input]:h-6.5 sm:[&_input]:leading-6.5";

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
        aria-label="Add a checklist"
        className={cn(CHECKLIST_INPUT, "text-xs")}
        onChange={(e) => setText(e.target.value)}
        placeholder="+ Add a checklist…"
        size="sm"
        unstyled
        value={text}
      />
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-1 border-t pt-3">
      <h4 className="mb-1 font-medium text-muted-foreground text-xs">
        Checklist
      </h4>
      {items.map((item, idx) => (
        <div
          className="group/item flex items-center gap-2.5"
          key={`${idx}-${item}`}
        >
          <span
            aria-hidden="true"
            className="ms-1 size-1 shrink-0 rounded-full bg-muted-foreground/48"
          />
          <span className="flex-1 text-sm">{item}</span>
          <Button
            aria-label="Remove item"
            className="text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover/item:opacity-100 pointer-coarse:opacity-100"
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
            size="icon-xs"
            variant="ghost"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <PlusIcon
          aria-hidden="true"
          className="size-3 shrink-0 text-muted-foreground"
        />
        <Input
          aria-label="Add a step"
          autoFocus
          className={CHECKLIST_INPUT}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a step, press Enter"
          size="sm"
          unstyled
          value={text}
        />
      </div>
    </div>
  );
}
