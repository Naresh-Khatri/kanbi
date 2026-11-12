"use client";

import {
  CircleAlertIcon,
  EyeIcon,
  type LucideIcon,
  PenLineIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/server/better-auth/client";

const SCOPE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  openid: { label: "Confirm your identity", Icon: ShieldCheckIcon },
  profile: { label: "Read your basic profile", Icon: ShieldCheckIcon },
  email: { label: "Read your email address", Icon: ShieldCheckIcon },
  offline_access: {
    label: "Stay connected without re-authorizing",
    Icon: RefreshCwIcon,
  },
  "kanbi:read": {
    label: "Read your projects, boards, and tasks",
    Icon: EyeIcon,
  },
  "kanbi:write": {
    label: "Create and edit tasks, comments, and more",
    Icon: PenLineIcon,
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

  // provider only passes client_id + scope -> resolve name from the registered client
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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Authorize {appName}</CardTitle>
        <CardDescription>
          {appName} wants to access your Kanbi account.
          {session?.user?.email ? (
            <>
              {" "}
              Signed in as{" "}
              <span className="text-foreground">{session.user.email}</span>.
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-3">
        <p className="font-medium text-muted-foreground text-xs">
          It will be able to
        </p>
        <ul className="flex flex-col gap-2.5">
          {scopes.length === 0 ? (
            <li className="text-muted-foreground text-sm">Basic access.</li>
          ) : (
            scopes.map((scope) => {
              const meta = SCOPE_META[scope];
              const Icon = meta?.Icon ?? ShieldCheckIcon;
              return (
                <li className="flex items-center gap-2.5 text-sm" key={scope}>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <Icon aria-hidden="true" className="size-3.5" />
                  </span>
                  <span>{meta?.label ?? scope}</span>
                </li>
              );
            })
          )}
        </ul>
        {error ? (
          <Alert className="mt-2" variant="error">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardPanel>
      <CardFooter className="flex-col gap-4">
        <div className="flex w-full items-center gap-2">
          <Button
            className="flex-1"
            disabled={busy === "accept"}
            loading={busy === "deny"}
            onClick={() => decide(false)}
            size="lg"
            type="button"
            variant="outline"
          >
            Deny
          </Button>
          <Button
            className="flex-1"
            disabled={busy === "deny"}
            loading={busy === "accept"}
            onClick={() => decide(true)}
            size="lg"
            type="button"
          >
            Authorize
          </Button>
        </div>
        <p className="text-center text-muted-foreground text-xs">
          You can revoke access anytime from your Kanbi settings.
        </p>
      </CardFooter>
    </Card>
  );
}
