"use client";

import { Card } from "@/components/ui/surface";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  formatDateTime,
  formatRelative,
  type PairPayload,
} from "@kanbi/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/env.js";
import { api } from "@/trpc/react";

const LAN_HOST = env.NEXT_PUBLIC_LAN_HOST ?? "10.0.0.10";

function rewriteForLan(origin: string): string {
  if (!origin) return origin;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      url.hostname = LAN_HOST;
    }
    return url.origin;
  } catch {
    return origin;
  }
}

export function DevicesSection() {
  const utils = api.useUtils();
  const list = api.device.list.useQuery();
  const issue = api.device.issue.useMutation({
    onSuccess: () => utils.device.list.invalidate(),
  });
  const revoke = api.device.revoke.useMutation({
    onSuccess: () => utils.device.list.invalidate(),
  });

  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [issued, setIssued] = useState<{
    deviceId: string;
    token: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const baseUrl = useMemo(() => rewriteForLan(origin), [origin]);
  const wasRewritten = baseUrl !== origin;

  const payload: PairPayload | null = issued
    ? {
        v: 2,
        baseUrl,
        deviceToken: issued.token,
        deviceId: issued.deviceId,
      }
    : null;
  const encoded = payload ? JSON.stringify(payload) : "";

  const handleIssue = async () => {
    try {
      const result = await issue.mutateAsync({
        name: name.trim() || undefined,
      });
      setIssued({ deviceId: result.id, token: result.token });
      setName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to pair device");
    }
  };

  return (
    <section className="mt-12 border-t border-white/10 pt-8">
      <header className="mb-4">
        <h2 className="text-sm font-medium text-white">Focus devices</h2>
        <p className="mt-1 text-xs text-white/70">
          Pair the Kanbi Focus phone app. Each device gets its own token so you
          can revoke individually.
        </p>
      </header>

      {payload ? (
        <Card className="mb-6" tone="muted">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG level="M" size={208} value={encoded} />
            </div>
            <p className="text-center text-xs text-white/70">
              Open Kanbi Focus on your phone, tap “Pair via QR”, and scan.
            </p>
            <p className="text-2xs text-center text-white/40">{baseUrl}</p>
            {wasRewritten ? (
              <Card
                as="p"
                className="text-2xs px-2 py-1 text-white/40"
                padding="none"
                radius="md"
                tone="muted"
              >
                Rewrote {new URL(origin).hostname} → {LAN_HOST}. Override with
                NEXT_PUBLIC_LAN_HOST.
              </Card>
            ) : null}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(encoded);
                  toast.success("Pairing payload copied");
                }}
                size="sm"
                variant="outline"
              >
                Copy payload
              </Button>
              <Button
                onClick={() => setIssued(null)}
                size="sm"
                variant="outline"
              >
                Done
              </Button>
            </div>
            <p className="text-2xs text-warning text-center">
              The token is shown once — leave this open until your phone has
              paired.
            </p>
          </div>
        </Card>
      ) : (
        <div className="mb-6 flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs text-white/70" htmlFor="device-name">
              New device name
            </Label>
            <Input
              className="mt-1"
              id="device-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="iPhone 15 / kitchen tablet / …"
              value={name}
            />
          </div>
          <Button disabled={issue.isPending} onClick={handleIssue}>
            <Smartphone className="mr-2 h-4 w-4" />
            Pair new device
          </Button>
        </div>
      )}

      <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
        {list.isLoading ? (
          <li className="px-4 py-3 text-xs text-white/40">Loading…</li>
        ) : !list.data || list.data.length === 0 ? (
          <li className="px-4 py-3 text-xs text-white/40">
            No paired devices.
          </li>
        ) : (
          list.data.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{d.name}</p>
                <p className="text-2xs text-white/40">
                  <span className="font-mono">{d.tokenPrefix}…</span>
                  {" · "}
                  {d.lastSeenAt ? (
                    <span title={formatDateTime(d.lastSeenAt)}>
                      last seen {formatRelative(d.lastSeenAt)}
                    </span>
                  ) : (
                    "never used"
                  )}
                </p>
              </div>
              <Button
                aria-label="Revoke"
                disabled={revoke.isPending}
                onClick={() => {
                  if (
                    confirm(`Revoke "${d.name}"? The device will sign out.`)
                  ) {
                    revoke.mutate({ id: d.id });
                  }
                }}
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
