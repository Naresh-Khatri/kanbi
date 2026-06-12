"use client";

import {
  Eye,
  type LucideIcon,
  PenLine,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { authClient } from "@/server/better-auth/client";

const SCOPE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  openid: { label: "Confirm your identity", Icon: ShieldCheck },
  profile: { label: "Read your basic profile", Icon: ShieldCheck },
  email: { label: "Read your email address", Icon: ShieldCheck },
  offline_access: {
    label: "Stay connected without re-authorizing",
    Icon: RefreshCw,
  },
  "kanbi:read": {
    label: "Read your projects, boards, and tasks",
    Icon: Eye,
  },
  "kanbi:write": {
    label: "Create and edit tasks, comments, and more",
    Icon: PenLine,
  },
};

export function ConsentForm() {
  const params = useSearchParams();
  const clientId = params.get("client_id") ?? "";
  const scopes = (params.get("scope") ?? "").split(/\s+/).filter(Boolean);

  const { data: session } = authClient.useSession();
  const [clientName, setClientName] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The provider only passes client_id + scope; resolve the human name from the
  // registered client (we're already authenticated on the consent step).
  useEffect(() => {
    if (!clientId) return;
    let active = true;
    void authClient.oauth2
      .publicClient({ query: { client_id: clientId } })
      .then((res) => {
        const name = res.data?.name;
        if (active && !res.error && typeof name === "string") {
          setClientName(name);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [clientId]);

  const appName = clientName ?? "An application";

  async function decide(accept: boolean) {
    setBusy(accept ? "accept" : "deny");
    setError(null);
    const res = await authClient.oauth2.consent({ accept });
    if (res.error) {
      setError(res.error.message ?? "Something went wrong. Please try again.");
      setBusy(null);
      return;
    }
    if (res.data?.url) window.location.href = res.data.url;
    else setBusy(null);
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 text-white/80">
        <Logo className="h-5 w-5" />
        <span className="text-sm font-medium">Kanbi</span>
      </div>

      <h1 className="mt-5 text-lg font-semibold text-white">
        Authorize {appName}
      </h1>
      <p className="mt-1 text-[13px] text-white/50">
        {appName} wants to access your Kanbi account.
        {session?.user?.email ? (
          <>
            {" "}
            Signed in as{" "}
            <span className="text-white/70">{session.user.email}</span>.
          </>
        ) : null}
      </p>

      <p className="mt-5 text-[11px] font-medium tracking-wide text-white/40 uppercase">
        It will be able to
      </p>
      <ul className="mt-2 flex flex-col gap-2.5">
        {scopes.length === 0 ? (
          <li className="text-[13px] text-white/40">Basic access.</li>
        ) : (
          scopes.map((scope) => {
            const meta = SCOPE_META[scope];
            const Icon = meta?.Icon ?? ShieldCheck;
            return (
              <li
                key={scope}
                className="flex items-center gap-2.5 text-[13px] text-white/70"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03]">
                  <Icon className="h-3.5 w-3.5 text-white/60" />
                </span>
                <span>{meta?.label ?? scope}</span>
              </li>
            );
          })
        )}
      </ul>

      {error ? (
        <p className="mt-4 text-[13px] text-red-400/90">{error}</p>
      ) : null}

      <div className="mt-6 flex items-center gap-2">
        <Button
          className="flex-1"
          disabled={busy !== null}
          onClick={() => decide(false)}
          type="button"
          variant="outline"
        >
          {busy === "deny" ? "Denying…" : "Deny"}
        </Button>
        <Button
          className="flex-1"
          disabled={busy !== null}
          onClick={() => decide(true)}
          type="button"
        >
          {busy === "accept" ? "Authorizing…" : "Authorize"}
        </Button>
      </div>

      <p className="mt-4 text-center text-[11px] text-white/35">
        You can revoke access anytime from your Kanbi settings.
      </p>
    </div>
  );
}
