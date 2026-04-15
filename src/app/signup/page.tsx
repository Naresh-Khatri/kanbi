"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/server/better-auth/client";

export default function SignupPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setPending(true);
		const res = await authClient.signUp.email({ name, email, password });
		setPending(false);
		if (res.error) {
			toast.error(res.error.message ?? "Sign up failed");
			return;
		}
		router.push("/app");
		router.refresh();
	}

	return (
		<main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
			<div className="flex flex-col gap-1">
				<h1 className="font-semibold text-2xl">Create your account</h1>
				<p className="text-sm text-white/60">It takes about 20 seconds.</p>
			</div>
			<form className="flex flex-col gap-3" onSubmit={onSubmit}>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="name">Name</Label>
					<Input
						autoComplete="name"
						id="name"
						onChange={(e) => setName(e.target.value)}
						required
						value={name}
					/>
				</div>
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
						autoComplete="new-password"
						id="password"
						minLength={8}
						onChange={(e) => setPassword(e.target.value)}
						required
						type="password"
						value={password}
					/>
				</div>
				<Button disabled={pending} type="submit">
					{pending ? "Creating…" : "Create account"}
				</Button>
			</form>
			<p className="text-center text-sm text-white/60">
				Already have an account?{" "}
				<Link className="text-white underline" href="/login">
					Sign in
				</Link>
			</p>
		</main>
	);
}
