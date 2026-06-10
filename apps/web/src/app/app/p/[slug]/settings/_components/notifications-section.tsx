"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
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
      toast.error(e.message);
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm text-white/90">Weekly digest email</span>
          <span className="text-xs text-white/50">
            An AI summary of the week&apos;s activity, sent once a week.
          </span>
        </div>
        <button
          aria-checked={enabled}
          aria-label="Weekly digest email"
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition",
            enabled ? "bg-white" : "bg-white/15",
            busy && "opacity-50",
          )}
          disabled={busy}
          onClick={() => toggle(!enabled)}
          role="switch"
          type="button"
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full transition-all",
              enabled ? "left-[18px] bg-black" : "left-0.5 bg-white/70",
            )}
          />
        </button>
      </div>
    </Section>
  );
}
