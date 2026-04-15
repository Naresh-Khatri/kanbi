"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/server/better-auth/client";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setPending(true);
		const res = await authClient.signIn.email({ email, password });
		setPending(false);
		if (res.error) {
			toast.error(res.error.message ?? "Sign in failed");
			return;
		}
		router.push("/app");
		router.refresh();
	}

	async function onGithub() {
		await authClient.signIn.social({
			provider: "github",
			callbackURL: "/app",
		});
	}

	return (
		<main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
			<div className="flex flex-col gap-1">
				<h1 className="font-semibold text-2xl">Sign in to Kanbi</h1>
				<p className="text-sm text-white/60">
					Welcome back. Use email or continue with GitHub.
				</p>
			</div>
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="email">Email</Label>
					<Input
						autoComplete="email"
						id="email"
						onChange={(e) => setEmail(e.target.value)}
						required
						type="email"
						value={email}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="password">Password</Label>
					<Input
						autoComplete="current-password"
						id="password"
						onChange={(e) => setPassword(e.target.value)}
						required
						type="password"
						value={password}
					/>
				</div>
				<Button disabled={pending} type="submit">
					{pending ? "Signing in…" : "Sign in"}
				</Button>
			</form>
			<div className="flex items-center gap-3 text-white/40 text-xs">
				<div className="h-px flex-1 bg-white/10" />
				or
				<div className="h-px flex-1 bg-white/10" />
			</div>
			<Button onClick={onGithub} variant="outline">
				Continue with GitHub
			</Button>
			<p className="text-center text-sm text-white/60">
				No account?{" "}
				<Link className="text-white underline" href="/signup">
					Create one
				</Link>
			</p>
		</main>
	);
}
