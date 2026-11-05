"use client";

import { IconTile } from "@/components/ui/surface";
import { Plug, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { formatRelative } from "@kanbi/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/server/better-auth/client";
import { api } from "@/trpc/react";

/** A single granted OAuth consent, as returned by the provider client. */
type Consent = NonNullable<
  Awaited<ReturnType<typeof authClient.oauth2.getConsents>>["data"]
>[number];

/** Short pill labels for the scopes the MCP provider issues. */
const SCOPE_LABEL: Record<string, string> = {
  openid: "Identity",
  profile: "Profile",
  email: "Email",
  offline_access: "Stay signed in",
  "kanbi:read": "Read",
  "kanbi:write": "Write",
};

/**
 * Connected-apps manager: lists the OAuth grants the user has authorized (the
 * agents/tools that reach Kanbi over MCP) and lets them revoke each one. This
 * is the settings page the consent screen points to ("revoke anytime from your
 * Kanbi settings"). Backed by the Better Auth OAuth provider client rather than
 * tRPC, mirroring the consent flow.
 */
export function ConnectedAppsSection() {
  const revokeConnectedApp = api.user.revokeConnectedApp.useMutation();
  const [consents, setConsents] = useState<Consent[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authClient.oauth2.getConsents();
    const rows = res.data ?? [];
    setConsents(rows);

    // The consent row only carries a clientId; resolve a human name per distinct
    // client with the same public lookup the consent screen uses.
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
    const label = names[c.clientId] ?? "this app";
    if (
      !confirm(`Revoke access for ${label}? It will need to be re-authorized.`)
    ) {
      return;
    }
    setRevoking(c.id);
    try {
      await revokeConnectedApp.mutateAsync({ consentId: c.id });
      setConsents(
        (prev) => prev?.filter((x) => x.clientId !== c.clientId) ?? prev,
      );
      toast.success("Access revoked");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke access",
      );
    } finally {
      setRevoking(null);
    }
  }

  return (
    <section className="mt-12 border-t border-white/10 pt-8">
      <header className="mb-4">
        <h2 className="text-sm font-medium text-white">Connected apps</h2>
        <p className="mt-1 text-xs text-white/70">
          Agents and tools you&apos;ve authorized to reach your Kanbi account
          over MCP. Revoke any you no longer use.
        </p>
      </header>

      <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
        {consents === null ? (
          <li className="px-4 py-3 text-xs text-white/40">Loading…</li>
        ) : consents.length === 0 ? (
          <li className="px-4 py-3 text-xs text-white/40">
            No connected apps.
          </li>
        ) : (
          consents.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <IconTile size="sm">
                  <Plug className="h-4 w-4" />
                </IconTile>
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">
                    {names[c.clientId] ?? c.clientId}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {c.scopes
                      .filter((s: string) => SCOPE_LABEL[s])
                      .map((s: string) => (
                        <Badge key={s}>{SCOPE_LABEL[s]}</Badge>
                      ))}
                    {c.createdAt ? (
                      <span className="text-2xs text-white/40">
                        · granted {formatRelative(c.createdAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <Button
                aria-label="Revoke access"
                disabled={revoking === c.id}
                onClick={() => revoke(c)}
                size="icon-sm"
                type="button"
                variant="quiet-danger"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
