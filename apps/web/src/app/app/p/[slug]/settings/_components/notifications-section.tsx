"use client";

import { useEffect, useState } from "react";

import { CardPanel } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { api } from "@/trpc/react";
import { Section } from "./section";

export function NotificationsSection({ projectId }: { projectId: string }) {
  const utils = api.useUtils();
  const prefs = api.project.notificationPrefs.useQuery({ projectId });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (prefs.data) setEnabled(prefs.data.digestEmail);
  }, [prefs.data]);

  const setDigest = api.project.setDigestEmail.useMutation({
    onSuccess: () => utils.project.notificationPrefs.invalidate({ projectId }),
    onError: (e) => {
      toastManager.add({ type: "error", title: e.message });
      if (prefs.data) setEnabled(prefs.data.digestEmail);
    },
  });

  const toggle = (next: boolean) => {
    setEnabled(next); // optimistic
    setDigest.mutate({ projectId, enabled: next });
  };

  const busy = prefs.isLoading || setDigest.isPending;

  return (
    <Section
      description="Control what Kanbi emails you for this project."
      id="notifications"
      title="Notifications"
    >
      <CardPanel>
        <Label className="has-data-checked:bg-accent/50 flex items-center justify-between gap-6 rounded-lg border p-4">
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium">Weekly digest email</span>
            <span className="text-muted-foreground text-xs font-normal">
              An AI summary of the week&apos;s activity, sent once a week.
            </span>
          </span>
          <Switch checked={enabled} disabled={busy} onCheckedChange={toggle} />
        </Label>
      </CardPanel>
    </Section>
  );
}
