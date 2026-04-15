"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, Textarea } from "@/components/ui/input";
import { api, type RouterOutputs } from "@/trpc/react";

type BoardData = RouterOutputs["board"]["get"];
type TaskRow = BoardData["tasks"][number];
type ColumnRow = BoardData["columns"][number];

export function BoardView({
	boardId,
	projectName,
}: {
	boardId: string;
	projectName: string;
	projectSlug: string;
}) {
	const [data] = api.board.get.useSuspenseQuery({ boardId });
	const { columns, tasks, access } = data;
	const canWrite = access.canWrite;

	const tasksByColumn = useMemo(() => {
		const map = new Map<string, TaskRow[]>();
		for (const c of columns) map.set(c.id, []);
		for (const t of tasks) {
			if (t.archivedAt) continue;
			const list = map.get(t.columnId);
			if (list) list.push(t);
		}
		return map;
	}, [columns, tasks]);

	return (
		<main className="flex h-[calc(100vh-57px)] flex-col">
			<div className="flex items-center justify-between border-white/5 border-b px-6 py-3">
				<h1 className="font-semibold text-xl">{projectName}</h1>
			</div>
			<div className="flex-1 overflow-x-auto">
				<div className="flex h-full min-w-max gap-4 p-6">
					{columns.map((col) => (
						<ColumnView
							boardId={boardId}
							canWrite={canWrite}
							column={col}
							key={col.id}
							tasks={tasksByColumn.get(col.id) ?? []}
						/>
					))}
					{canWrite ? <AddColumn boardId={boardId} /> : null}
				</div>
			</div>
		</main>
	);
}

function ColumnView({
	boardId,
	column,
	tasks,
	canWrite,
}: {
	boardId: string;
	column: ColumnRow;
	tasks: TaskRow[];
	canWrite: boolean;
}) {
	const utils = api.useUtils();
	const [renaming, setRenaming] = useState(false);
	const [name, setName] = useState(column.name);

	const rename = api.column.rename.useMutation({
		onSuccess: async () => {
			setRenaming(false);
			await utils.board.get.invalidate({ boardId });
		},
		onError: (e) => toast.error(e.message),
	});
	const remove = api.column.delete.useMutation({
		onSuccess: async () => {
			await utils.board.get.invalidate({ boardId });
		},
		onError: (e) => toast.error(e.message),
	});

	return (
		<div className="flex w-72 shrink-0 flex-col gap-3 rounded-xl bg-white/[0.03] p-3">
			<div className="flex items-center justify-between gap-2 px-1">
				{renaming ? (
					<form
						className="flex-1"
						onSubmit={(e) => {
							e.preventDefault();
							rename.mutate({ boardId, columnId: column.id, name });
						}}
					>
						<Input
							autoFocus
							onBlur={() => setRenaming(false)}
							onChange={(e) => setName(e.target.value)}
							value={name}
						/>
					</form>
				) : (
					<button
						className="flex-1 text-left font-medium text-sm"
						disabled={!canWrite}
						onClick={() => setRenaming(true)}
						type="button"
					>
						{column.name}
						<span className="ml-2 text-white/40 text-xs">{tasks.length}</span>
					</button>
				)}
				{canWrite ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button size="icon" variant="ghost">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={() => setRenaming(true)}>
								Rename
							</DropdownMenuItem>
							<DropdownMenuItem
								destructive
								onSelect={() => remove.mutate({ boardId, columnId: column.id })}
							>
								Delete column
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</div>
			<div className="flex flex-col gap-2">
				{tasks.map((t) => (
					<TaskCard boardId={boardId} key={t.id} task={t} />
				))}
			</div>
			{canWrite ? <AddTask boardId={boardId} columnId={column.id} /> : null}
		</div>
	);
}

function TaskCard({ boardId, task }: { boardId: string; task: TaskRow }) {
	const utils = api.useUtils();
	const remove = api.task.delete.useMutation({
		onSuccess: () => utils.board.get.invalidate({ boardId }),
	});
	return (
		<div className="group rounded-lg border border-white/5 bg-[#14151c] p-3 transition hover:border-white/15">
			<div className="flex items-start justify-between gap-2">
				<p className="text-sm leading-snug">{task.title}</p>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="opacity-0 group-hover:opacity-100"
							size="icon"
							variant="ghost"
						>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							destructive
							onSelect={() => remove.mutate({ boardId, taskId: task.id })}
						>
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			{task.priority !== "none" ? (
				<div className="mt-2 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 uppercase tracking-wide">
					{task.priority}
				</div>
			) : null}
		</div>
	);
}

function AddTask({ boardId, columnId }: { boardId: string; columnId: string }) {
	const utils = api.useUtils();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const create = api.task.create.useMutation({
		onSuccess: async () => {
			setTitle("");
			setOpen(false);
			await utils.board.get.invalidate({ boardId });
		},
		onError: (e) => toast.error(e.message),
	});

	if (!open) {
		return (
			<Button
				className="justify-start text-white/60"
				onClick={() => setOpen(true)}
				size="sm"
				variant="ghost"
			>
				<Plus className="h-4 w-4" /> Add task
			</Button>
		);
	}

	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				if (!title.trim()) return;
				create.mutate({ boardId, columnId, title: title.trim() });
			}}
		>
			<Textarea
				autoFocus
				onChange={(e) => setTitle(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						if (title.trim()) {
							create.mutate({ boardId, columnId, title: title.trim() });
						}
					}
					if (e.key === "Escape") setOpen(false);
				}}
				placeholder="Task title — ⏎ to add, Esc to cancel"
				value={title}
			/>
			<div className="flex gap-2">
				<Button disabled={create.isPending} size="sm" type="submit">
					Add
				</Button>
				<Button
					onClick={() => setOpen(false)}
					size="sm"
					type="button"
					variant="ghost"
				>
					Cancel
				</Button>
			</div>
		</form>
	);
}

function AddColumn({ boardId }: { boardId: string }) {
	const utils = api.useUtils();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const create = api.column.create.useMutation({
		onSuccess: async () => {
			setOpen(false);
			setName("");
			await utils.board.get.invalidate({ boardId });
		},
		onError: (e) => toast.error(e.message),
	});

	if (!open) {
		return (
			<Button
				className="h-10 w-72 shrink-0 justify-start"
				onClick={() => setOpen(true)}
				variant="outline"
			>
				<Plus className="h-4 w-4" /> Add column
			</Button>
		);
	}
	return (
		<form
			className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-white/[0.03] p-3"
			onSubmit={(e) => {
				e.preventDefault();
				if (!name.trim()) return;
				create.mutate({ boardId, name: name.trim() });
			}}
		>
			<Input
				autoFocus
				onChange={(e) => setName(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape") setOpen(false);
				}}
				placeholder="Column name"
				value={name}
			/>
			<div className="flex gap-2">
				<Button disabled={create.isPending} size="sm" type="submit">
					Add
				</Button>
				<Button
					onClick={() => setOpen(false)}
					size="sm"
					type="button"
					variant="ghost"
				>
					Cancel
				</Button>
			</div>
		</form>
	);
}
