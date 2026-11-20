"use client";

import { TRPCClientError } from "@trpc/client";
import { useEffect, useState } from "react";

import { toastManager } from "@/components/ui/toast";
import { loginUrl } from "@/lib/return-url";

// drafts register here so an expiry never navigates away from them
const unsaved = new Set<symbol>();
let toastId: string | null = null;
let redirecting = false;

export function useUnsavedWork(dirty: boolean) {
  const [key] = useState(() => Symbol("unsaved"));
  useEffect(() => {
    if (!dirty) return;
    unsaved.add(key);
    return () => {
      unsaved.delete(key);
    };
  }, [key, dirty]);
}

export function isUnauthorized(error: unknown) {
  return (
    error instanceof TRPCClientError &&
    (error.data as { code?: string } | undefined)?.code === "UNAUTHORIZED"
  );
}

function isTyping() {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement &&
      !["checkbox", "radio", "button"].includes(el.type))
  );
}

/** mutations + unsaved drafts -> toast (sign in in new tab, keep page); else redirect */
export function onSessionExpired(source: "query" | "mutation") {
  if (typeof window === "undefined" || redirecting) return;
  const { pathname, search } = window.location;
  // public share/invite pages never need a session
  if (!pathname.startsWith("/app")) return;
  const url = loginUrl(pathname + search, { expired: true });

  if (source === "query" && unsaved.size === 0 && !isTyping()) {
    redirecting = true;
    window.location.assign(url);
    return;
  }
  if (toastId) return;
  toastId = toastManager.add({
    type: "warning",
    title: "Your session expired",
    description:
      "Sign in again in a new tab, then retry. Your changes are still here.",
    timeout: 0,
    actionProps: {
      children: "Sign in",
      onClick: () => window.open(url, "_blank", "noopener"),
    },
    onClose: () => {
      toastId = null;
    },
  });
}

/** any authed request succeeding -> signed back in, drop the toast */
export function onSessionOk() {
  if (toastId) toastManager.close(toastId);
}
