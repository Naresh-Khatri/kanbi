"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

export function ProjectsDashboard() {
	const [projects] = api.project.list.useSuspenseQuery();

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-2xl">Projects</h1>
					<p className="text-sm text-white/60">
						Create a project, get a board, start shipping.
					</p>
				</div>
				<NewProjectDialog />
			</div>

			{projects.length === 0 ? (
				<div className="rounded-xl border border-white/10 border-dashed p-10 text-center text-white/60">
					No projects yet. Create your first one.
				</div>
			) : (
				<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{projects.map((p) => (
						<li key={p.id}>
							<Link
								className="block rounded-xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/5"
								href={`/app/p/${p.slug}`}
							>
								<div className="flex items-center gap-2">
									<span
										className="h-3 w-3 rounded-full"
										style={{ background: p.color ?? "#6366f1" }}
									/>
									<span className="font-medium">{p.name}</span>
								</div>
								{p.description ? (
									<p className="mt-2 line-clamp-2 text-sm text-white/60">
										{p.description}
									</p>
								) : null}
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function NewProjectDialog() {
	const utils = api.useUtils();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	const create = api.project.create.useMutation({
		onSuccess: async () => {
			toast.success("Project created");
			setOpen(false);
			setName("");
			setDescription("");
			await utils.project.list.invalidate();
		},
		onError: (err) => toast.error(err.message),
	});

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="h-4 w-4" /> New project
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New project</DialogTitle>
					<DialogDescription>
						Each project comes with a board out of the box.
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-3"
					onSubmit={(e) => {
						e.preventDefault();
						create.mutate({
							name,
							description: description || undefined,
						});
					}}
				>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="project-name">Name</Label>
						<Input
							autoFocus
							id="project-name"
							onChange={(e) => setName(e.target.value)}
							required
							value={name}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="project-description">Description</Label>
						<Textarea
							id="project-description"
							onChange={(e) => setDescription(e.target.value)}
							value={description}
						/>
					</div>
					<DialogFooter>
						<Button
							onClick={() => setOpen(false)}
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
						<Button disabled={create.isPending} type="submit">
							{create.isPending ? "Creating…" : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
