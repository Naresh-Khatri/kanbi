"use client";

import {
  formatDateTime,
  formatRelative,
  type PairPayload,
} from "@kanbi/shared";
import { SmartphoneIcon, Trash2Icon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
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
    onSuccess: () => {
      setRevoking(null);
      return utils.device.list.invalidate();
    },
    onError: (e) => toastManager.add({ type: "error", title: e.message }),
  });

  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [issued, setIssued] = useState<{
    deviceId: string;
    token: string;
  } | null>(null);
  const [revoking, setRevoking] = useState<{ id: string; name: string } | null>(
    null,
  );

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
      toastManager.add({
        type: "error",
        title: e instanceof Error ? e.message : "Failed to pair device",
      });
    }
  };

  const devices = list.data ?? [];

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base" render={<h2 />}>
          Focus devices
        </CardTitle>
        <CardDescription>
          Pair the Kanbi Focus phone app. Each device gets its own token so you
          can revoke them one at a time.
        </CardDescription>
      </CardHeader>
      <CardPanel>
        <Form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void handleIssue();
          }}
        >
          <Field className="flex-1" name="deviceName">
            <FieldLabel>New device name</FieldLabel>
            <Input
              onChange={(e) => setName(e.target.value)}
              placeholder="iPhone 15 / kitchen tablet / …"
              value={name}
            />
          </Field>
          <Button loading={issue.isPending} type="submit">
            <SmartphoneIcon aria-hidden="true" />
            Pair new device
          </Button>
        </Form>
      </CardPanel>

      {list.isLoading ? (
        <div className="flex flex-col gap-2 border-t px-6 py-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      ) : devices.length === 0 ? (
        <Empty className="border-t py-8 md:py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SmartphoneIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle className="text-base">No paired devices</EmptyTitle>
            <EmptyDescription>
              Name a device above and scan the QR code from Kanbi Focus.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table
          className="[&_tr>*:first-child]:ps-6 [&_tr>*:last-child]:pe-6"
          render={<div className="border-t" />}
        >
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="max-w-0 truncate font-medium">
                  {d.name}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {d.tokenPrefix}…
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {d.lastSeenAt ? (
                    <span title={formatDateTime(d.lastSeenAt)}>
                      {formatRelative(d.lastSeenAt)}
                    </span>
                  ) : (
                    "Never used"
                  )}
                </TableCell>
                <TableCell className="text-end">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          aria-label={`Revoke ${d.name}`}
                          onClick={() =>
                            setRevoking({ id: d.id, name: d.name })
                          }
                          size="icon-sm"
                          variant="ghost"
                        />
                      }
                    >
                      <Trash2Icon aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipPopup>Revoke</TooltipPopup>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) setIssued(null);
        }}
        open={payload !== null}
      >
        <DialogPopup className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan to pair</DialogTitle>
            <DialogDescription>
              Open Kanbi Focus on your phone, tap “Pair via QR”, and scan.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col items-center gap-3">
            {/* qr needs a light quiet zone to scan in dark mode */}
            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG level="M" size={208} value={encoded} />
            </div>
            <p className="text-muted-foreground text-center font-mono text-xs">
              {baseUrl}
            </p>
            {wasRewritten ? (
              <p className="text-muted-foreground text-center text-xs">
                Rewrote {origin ? new URL(origin).hostname : "localhost"} →{" "}
                {LAN_HOST}. Override with NEXT_PUBLIC_LAN_HOST.
              </p>
            ) : null}
            <Alert variant="warning">
              <AlertDescription>
                The token is shown once. Keep this open until your phone has
                paired.
              </AlertDescription>
            </Alert>
          </DialogPanel>
          <DialogFooter>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(encoded);
                  toastManager.add({
                    type: "success",
                    title: "Pairing payload copied",
                  });
                } catch {
                  toastManager.add({ type: "error", title: "Couldn't copy" });
                }
              }}
              variant="outline"
            >
              Copy payload
            </Button>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        open={revoking !== null}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke “{revoking?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The device will sign out and need to be paired again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>
              Cancel
            </AlertDialogClose>
            <Button
              loading={revoke.isPending}
              onClick={() => {
                if (revoking) revoke.mutate({ id: revoking.id });
              }}
              variant="destructive"
            >
              Revoke device
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </Card>
  );
}
