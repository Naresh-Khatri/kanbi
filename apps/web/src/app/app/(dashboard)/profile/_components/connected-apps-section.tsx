"use client";

import { formatRelative } from "@kanbi/shared";
import { PlugIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { authClient } from "@/server/better-auth/client";
import { api } from "@/trpc/react";

type Consent = NonNullable<
  Awaited<ReturnType<typeof authClient.oauth2.getConsents>>["data"]
>[number];

const SCOPE_LABEL: Record<string, string> = {
  openid: "Identity",
  profile: "Profile",
  email: "Email",
  offline_access: "Stay signed in",
  "kanbi:read": "Read",
  "kanbi:write": "Write",
};

// oauth grants for MCP agents; the consent screen points here to revoke.
// better auth client, not trpc, to mirror the consent flow
export function ConnectedAppsSection() {
  const revokeConnectedApp = api.user.revokeConnectedApp.useMutation();
  const [consents, setConsents] = useState<Consent[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<Consent | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    const res = await authClient.oauth2.getConsents();
    const rows = res.data ?? [];
    setConsents(rows);

    // consent row only has clientId -> resolve names via public lookup
    const ids = [...new Set(rows.map((r) => r.clientId))];
    const resolved = await Promise.all(
      ids.map(async (clientId) => {
        const r = await authClient.oauth2
          .publicClient({ query: { client_id: clientId } })
          .catch(() => null);
        const name = r?.data?.name;
        return [clientId, typeof name === "string" ? name : ""] as const;
      }),
    );
    setNames(Object.fromEntries(resolved.filter(([, n]) => n)));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(c: Consent) {
    setRevoking(true);
    try {
      await revokeConnectedApp.mutateAsync({ consentId: c.id });
      setConsents(
        (prev) => prev?.filter((x) => x.clientId !== c.clientId) ?? prev,
      );
      setConfirming(null);
      toastManager.add({ type: "success", title: "Access revoked" });
    } catch (error) {
      toastManager.add({
        type: "error",
        title:
          error instanceof Error ? error.message : "Failed to revoke access",
      });
    } finally {
      setRevoking(false);
    }
  }

  const confirmingLabel = confirming
    ? (names[confirming.clientId] ?? "this app")
    : "";

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base" render={<h2 />}>
          Connected apps
        </CardTitle>
        <CardDescription>
          Agents and tools you&apos;ve authorized to reach your Kanbi account
          over MCP. Revoke any you no longer use.
        </CardDescription>
      </CardHeader>

      {consents === null ? (
        <div className="flex flex-col gap-2 border-t px-6 py-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      ) : consents.length === 0 ? (
        <Empty className="border-t py-8 md:py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PlugIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle className="text-base">No connected apps</EmptyTitle>
            <EmptyDescription>
              Connect an agent like Claude Code or Cursor over MCP and it shows
              up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y border-t">
          {consents.map((c) => {
            const label = names[c.clientId] ?? c.clientId;
            return (
              <li
                className="flex items-center justify-between gap-3 px-6 py-3"
                key={c.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
                    <PlugIcon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate text-sm font-medium">{label}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      {c.scopes
                        .filter((s: string) => SCOPE_LABEL[s])
                        .map((s: string) => (
                          <Badge key={s} size="sm" variant="outline">
                            {SCOPE_LABEL[s]}
                          </Badge>
                        ))}
                      {c.createdAt ? (
                        <span className="text-muted-foreground text-xs">
                          · granted {formatRelative(c.createdAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label={`Revoke access for ${label}`}
                        onClick={() => setConfirming(c)}
                        size="icon-sm"
                        variant="ghost"
                      />
                    }
                  >
                    <Trash2Icon aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipPopup>Revoke access</TooltipPopup>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        open={confirming !== null}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Revoke access for {confirmingLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              It will need to be re-authorized before it can reach Kanbi again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>
              Cancel
            </AlertDialogClose>
            <Button
              loading={revoking}
              onClick={() => {
                if (confirming) void revoke(confirming);
              }}
              variant="destructive"
            >
              Revoke access
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </Card>
  );
}
