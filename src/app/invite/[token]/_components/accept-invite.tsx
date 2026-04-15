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

	// Auto-accept on mount. `accept.mutate` is stable per tRPC react-query;
	// depending on it would re-run the mutation unnecessarily.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => {
		accept.mutate({ token });
	}, [token]);

	return (
		<div className="flex max-w-sm flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-6">
			<h1 className="font-semibold text-lg">Project invitation</h1>
			{status === "idle" ? (
				<p className="text-sm text-white/60">Accepting invite…</p>
			) : null}
			{status === "err" ? (
				<>
					<p className="text-red-400 text-sm">{message}</p>
					<Button onClick={() => router.push("/app")} variant="outline">
						Go to dashboard
					</Button>
				</>
			) : null}
		</div>
	);
}
