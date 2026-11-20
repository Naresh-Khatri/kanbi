"use client";

import { useEffect } from "react";

import { onSessionExpired, onSessionOk } from "@/lib/session-expiry";
import { authClient } from "@/server/better-auth/client";

// idle tab (only SSE open) never sees a 401 -> recheck whenever it's shown again
export function SessionWatcher() {
  useEffect(() => {
    async function check() {
      if (document.visibilityState !== "visible") return;
      const { data, error } = await authClient.getSession();
      if (error) return;
      if (data) onSessionOk();
      else onSessionExpired("query");
    }
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);
  return null;
}
