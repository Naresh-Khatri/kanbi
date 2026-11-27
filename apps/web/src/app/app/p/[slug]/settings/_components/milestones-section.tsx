"use client";

import { formatDate } from "@kanbi/shared";
import {
  CircleCheckIcon,
  EllipsisIcon,
  FlagIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { CloseMilestoneDialog } from "@/components/milestone/close-milestone-dialog";
import {
  type EditableMilestone,
  MilestoneFormDialog,
} from "@/components/milestone/milestone-form-dialog";
import { MilestoneTarget } from "@/components/milestone/milestone-target";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { toastManager } from "@/components/ui/toast";
import { api, type RouterOutputs } from "@/trpc/react";
import { Section } from "./section";

type Row = RouterOutputs["milestone"]["list"][number];

const UNDO_WINDOW_MS = 6000;

export function MilestonesSection({
  boardId,
  slug,
  canWrite,
}: {
  boardId: string;
  slug: string;
  canWrite: boolean;
}) {
  const utils = api.useUtils();
  const input = { boardId, includeClosed: true };
  const rows = api.milestone.list.useQuery(input).data ?? [];
  const open = rows.filter((m) => m.status !== "closed");
  const closed = rows
    .filter((m) => m.status === "closed")
    .sort(
      (a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0),
    );

  const [form, setForm] = useState<{
    milestone: EditableMilestone | null;
  } | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const closing = open.find((m) => m.id === closingId) ?? null;

  const invalidate = () =>
    Promise.all([
      utils.milestone.list.invalidate({ boardId }),
      utils.board.get.invalidate({ boardId }),
    ]);
  const onError = (e: { message: string }) => {
    toastManager.add({ type: "error", title: e.message });
    void invalidate();
  };
  const reopen = api.milestone.update.useMutation({
    onSuccess: (row) => {
      void invalidate();
      toastManager.add({ type: "success", title: `${row.name} reopened` });
    },
    onError,
  });
  const del = api.milestone.delete.useMutation({
    onError,
    onSettled: invalidate,
  });

  // server delete held back so Undo just restores the cache
  const remove = async (m: Row) => {
    await utils.milestone.list.cancel(input);
    utils.milestone.list.setData(input, (old) =>
      old?.filter((r) => r.id !== m.id),
    );
    let undone = false;
    const commit = setTimeout(() => {
      if (!undone) del.mutate({ boardId, milestoneId: m.id });
    }, UNDO_WINDOW_MS);
    const toastId = toastManager.add({
      title: `Deleted ${m.name}`,
      description: "Its tasks stay on the board without a milestone.",
      timeout: UNDO_WINDOW_MS,
      actionProps: {
        children: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(commit);
          toastManager.close(toastId);
          void utils.milestone.list.invalidate(input);
        },
      },
    });
  };

  return (
    <>
      <Section
        action={
          canWrite ? (
            <Button
              onClick={() => setForm({ milestone: null })}
              size="sm"
              variant="outline"
            >
              <PlusIcon aria-hidden="true" /> New milestone
            </Button>
          ) : null
        }
        description="Group tasks into something you ship together: a release, a launch, a client review. The board can filter to one."
        id="milestones"
        title="Milestones"
      >
        <CardPanel>
          {open.length === 0 ? (
            <Empty className="rounded-xl border border-dashed py-8 md:py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FlagIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-base">
                  No open milestones
                </EmptyTitle>
                <EmptyDescription>
                  Milestones you create show up here and in the board toolbar.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="-my-2 flex flex-col divide-y">
              {open.map((m) => (
                <MilestoneRow
                  canWrite={canWrite}
                  key={m.id}
                  meta={
                    <>
                      <Badge
                        size="sm"
                        variant={m.status === "active" ? "info" : "outline"}
                      >
                        {m.status === "active" ? "Active" : "Upcoming"}
                      </Badge>
                      <MilestoneTarget targetAt={m.targetAt} />
                    </>
                  }
                  milestone={m}
                >
                  <MenuItem onClick={() => setForm({ milestone: m })}>
                    <PencilIcon aria-hidden="true" /> Edit
                  </MenuItem>
                  <MenuItem onClick={() => setClosingId(m.id)}>
                    <CircleCheckIcon aria-hidden="true" /> Close…
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    onClick={() => void remove(m)}
                    variant="destructive"
                  >
                    <Trash2Icon aria-hidden="true" /> Delete
                  </MenuItem>
                </MilestoneRow>
              ))}
            </ul>
          )}
        </CardPanel>
      </Section>

      {closed.length > 0 ? (
        <Section
          description="Closed milestones and what shipped in them."
          id="milestone-history"
          title="History"
        >
          <CardPanel>
            <ul className="-my-2 flex flex-col divide-y">
              {closed.map((m) => (
                <MilestoneRow
                  canWrite={canWrite}
                  key={m.id}
                  meta={
                    m.closedAt ? (
                      <span>closed {formatDate(m.closedAt)}</span>
                    ) : null
                  }
                  milestone={m}
                >
                  <MenuItem
                    onClick={() =>
                      reopen.mutate({
                        boardId,
                        milestoneId: m.id,
                        status: "active",
                      })
                    }
                  >
                    <RotateCcwIcon aria-hidden="true" /> Reopen
                  </MenuItem>
                  <MenuItem onClick={() => setForm({ milestone: m })}>
                    <PencilIcon aria-hidden="true" /> Edit
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    onClick={() => void remove(m)}
                    variant="destructive"
                  >
                    <Trash2Icon aria-hidden="true" /> Delete
                  </MenuItem>
                </MilestoneRow>
              ))}
            </ul>
          </CardPanel>
        </Section>
      ) : null}

      <MilestoneFormDialog
        boardId={boardId}
        milestone={form?.milestone}
        onOpenChange={(o) => {
          if (!o) setForm(null);
        }}
        open={form !== null}
      />
      <CloseMilestoneDialog
        boardId={boardId}
        finishedCount={closing?.finished ?? 0}
        milestone={closing}
        onOpenChange={(o) => {
          if (!o) setClosingId(null);
        }}
        otherMilestones={open.filter((m) => m.id !== closingId)}
        projectSlug={slug}
        unfinishedCount={closing?.unfinished ?? 0}
      />
    </>
  );
}

function MilestoneRow({
  milestone: m,
  meta,
  canWrite,
  children,
}: {
  milestone: Row;
  meta: React.ReactNode;
  canWrite: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{m.name}</span>
        <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
          {meta}
          <span className="tabular-nums">
            {m.progress.done}/{m.progress.total} done
          </span>
        </div>
        {m.description ? (
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {m.description}
          </p>
        ) : null}
      </div>
      {canWrite ? (
        <Menu>
          <MenuTrigger
            render={
              <Button
                aria-label={`Actions for ${m.name}`}
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <EllipsisIcon aria-hidden="true" />
          </MenuTrigger>
          <MenuPopup align="end">{children}</MenuPopup>
        </Menu>
      ) : null}
    </li>
  );
}
