"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  const accept = api.project.acceptInvite.useMutation({
    onSuccess: (res) => {
      setStatus("ok");
      if (res.projectSlug) {
        router.push(`/app/p/${res.projectSlug}`);
      } else {
        router.push("/app");
      }
    },
    onError: (err) => {
      setStatus("err");
      setMessage(err.message);
      toast.error(err.message);
    },
  });

  useEffect(() => {
    accept.mutate({ token });
  }, [token]);

  return (
    <div className="flex max-w-sm flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <h1 className="text-lg font-semibold">Project invitation</h1>
      {status === "idle" ? (
        <p className="text-sm text-white/60">Accepting invite…</p>
      ) : null}
      {status === "err" ? (
        <>
          <p className="text-sm text-red-400">{message}</p>
          <Button onClick={() => router.push("/app")} variant="outline">
            Go to dashboard
          </Button>
        </>
      ) : null}
    </div>
  );
}
