"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex max-w-md flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h1 className="font-semibold text-lg">Something went wrong</h1>
        <p className="text-sm text-white/60">
          {error.message || "Unexpected error."}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </div>
    </main>
  );
}
