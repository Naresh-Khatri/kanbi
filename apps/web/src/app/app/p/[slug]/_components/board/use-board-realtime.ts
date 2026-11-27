"use client";

import { invalidateProjectLifecycle } from "@/app/app/_components/invalidate-project-lifecycle";
import { isUnauthorized, onSessionExpired } from "@/lib/session-expiry";
import { api } from "@/trpc/react";

export function useBoardRealtime(boardId: string) {
  const utils = api.useUtils();
  api.realtime.onBoardChange.useSubscription(
    { boardId },
    {
      onError: (error) => {
        if (isUnauthorized(error)) onSessionExpired("query");
      },
      onData: (evt) => {
        if (evt.scope === "presence") {
          // Keeps the header team/presence popover live while the board is open.
          utils.realtime.presence.invalidate({ boardId });
          return;
        }
        if (evt.scope === "board") {
          void invalidateProjectLifecycle(utils);
          return;
        }
        if (evt.scope === "comment") {
          utils.comment.list.invalidate();
          utils.activity.list.invalidate();
          return;
        }
        if (evt.scope === "checklist") {
          utils.checklist.list.invalidate();
          return;
        }
        if (evt.scope === "attachment") {
          utils.attachment.list.invalidate();
          return;
        }
        if (evt.scope === "activity") {
          utils.activity.list.invalidate();
          utils.board.updates.invalidate({ boardId });
          return;
        }
        if (evt.scope === "milestone") {
          utils.milestone.list.invalidate({ boardId });
        }
        utils.board.get.invalidate({ boardId });
      },
    },
  );
}
