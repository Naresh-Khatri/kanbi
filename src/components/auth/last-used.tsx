"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "kanbi:last-used-auth";
const PROVIDERS = ["email", "github", "google"] as const;
export type LastUsedProvider = (typeof PROVIDERS)[number];

export function useLastUsedAuth() {
  const [lastUsed, setLastUsed] = useState<LastUsedProvider | null>(null);

  useEffect(() => {
    const v = localStorage.getItem(STORAGE_KEY);
    if (PROVIDERS.includes(v as LastUsedProvider)) {
      setLastUsed(v as LastUsedProvider);
    }
  }, []);

  function mark(provider: LastUsedProvider) {
    localStorage.setItem(STORAGE_KEY, provider);
  }

  return { lastUsed, mark };
}

export function LastUsedBadge() {
  return (
    <span className="-top-2 absolute right-2 rounded-full bg-white px-1.5 py-0.5 font-medium text-[10px] text-black shadow-sm">
      Last used
    </span>
  );
}
