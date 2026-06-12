"use client";

import { Plug, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { formatRelative } from "@kanbi/shared";

import { authClient } from "@/server/better-auth/client";

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
    const res = await authClient.oauth2.deleteConsent({ id: c.id });
    setRevoking(null);
    if (res.error) {
      toast.error(res.error.message ?? "Failed to revoke access");
      return;
    }
    setConsents((prev) => prev?.filter((x) => x.id !== c.id) ?? prev);
    toast.success("Access revoked");
  }

  return (
    <section className="mt-12 border-t border-white/10 pt-8">
      <header className="mb-4">
        <h2 className="text-sm font-medium text-white">Connected apps</h2>
        <p className="mt-1 text-xs text-white/50">
          Agents and tools you&apos;ve authorized to reach your Kanbi account
          over MCP. Revoke any you no longer use.
        </p>
      </header>

      <ul className="divide-y divide-white/5 rounded-lg border border-white/10">
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03]">
                  <Plug className="h-4 w-4 text-white/60" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">
                    {names[c.clientId] ?? c.clientId}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {c.scopes
                      .filter((s: string) => SCOPE_LABEL[s])
                      .map((s: string) => (
                        <span
                          key={s}
                          className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white/50"
                        >
                          {SCOPE_LABEL[s]}
                        </span>
                      ))}
                    {c.createdAt ? (
                      <span className="text-[11px] text-white/35">
                        · granted {formatRelative(c.createdAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                aria-label="Revoke access"
                className="rounded-md p-1.5 text-white/40 hover:bg-white/5 hover:text-red-400"
                disabled={revoking === c.id}
                onClick={() => revoke(c)}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
