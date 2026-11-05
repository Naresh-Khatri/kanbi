"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/surface";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="flex max-w-md flex-col gap-3" padding="lg">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-white/70">
          {error.message || "Unexpected error."}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </Card>
    </main>
  );
}
