"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone } from "lucide-react";
import { toast } from "sonner";

import { type PairPayload } from "@kanbi/shared";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { env } from "@/env.js";

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

export function PairFocusDialog({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const baseUrl = useMemo(() => rewriteForLan(origin), [origin]);
  const wasRewritten = baseUrl !== origin;

  const payload: PairPayload = { v: 1, baseUrl, token };
  const encoded = JSON.stringify(payload);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button
          aria-label="Pair Focus device"
          className="text-white/70 hover:text-white"
          type="button"
        >
          <Smartphone className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pair Focus app</DialogTitle>
          <DialogDescription>
            Open Kanbi Focus on your phone, tap “Pair via QR”, and scan the code
            below.
          </DialogDescription>
        </DialogHeader>

        {baseUrl ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-lg bg-white p-4">
              <QRCodeSVG level="M" size={224} value={encoded} />
            </div>
            <div className="w-full text-xs text-white/60">
              <p>
                <span className="text-white/40">Host:</span> {baseUrl}
              </p>
              <p className="mt-0.5 break-all">
                <span className="text-white/40">Token:</span> {token}
              </p>
            </div>
            {wasRewritten ? (
              <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                Rewrote <code>{new URL(origin).hostname}</code> → LAN host{" "}
                <code>{LAN_HOST}</code>. Override with{" "}
                <code>NEXT_PUBLIC_LAN_HOST</code> in <code>.env</code>.
              </p>
            ) : null}
            <Button
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(encoded);
                toast.success("Pairing payload copied");
              }}
              size="sm"
              variant="outline"
            >
              Copy payload
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
