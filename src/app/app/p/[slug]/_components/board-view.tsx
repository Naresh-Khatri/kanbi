"use client";

import {
	closestCorners,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	horizontalListSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Plus } from "lucide-react";
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
import { ShareDialog } from "./share-dialog";
import { TaskDetailSheet } from "./task-detail-sheet";

type BoardData = RouterOutputs["board"]["get"];
type TaskRow = BoardData["tasks"][number];
type ColumnRow = BoardData["columns"][number];

type ActiveDrag =
	| { kind: "task"; task: TaskRow }
	| { kind: "column"; column: ColumnRow }
	| null;

export function BoardView({
	boardId,
	projectId,
	projectName,
}: {
	boardId: string;
	projectId: string;
	projectName: string;
	projectSlug: string;
}) {
	const [data] = api.board.get.useSuspenseQuery({ boardId });
	const utils = api.useUtils();
	const { columns, tasks, labels, taskLabels, access } = data;
	const canWrite = access.canWrite;
	const [openTaskId, setOpenTaskId] = useState<string | null>(null);
	const openTask = openTaskId
		? (tasks.find((t) => t.id === openTaskId) ?? null)
		: null;

	api.realtime.onBoardChange.useSubscription(
		{ boardId },
		{
			onData: (evt) => {
				if (evt.scope === "comment") {
					utils.comment.list.invalidate();
					return;
				}
				if (evt.scope === "checklist") {
					utils.checklist.list.invalidate();
					return;
				}
				if (evt.scope === "attachment") {
					utils.attachment.list.invalidate();
					return;
				}
				utils.board.get.invalidate({ boardId });
			},
		},
	);

	const moveTask = api.task.move.useMutation({
		onSettled: () => utils.board.get.invalidate({ boardId }),
	});
	const reorderColumn = api.column.reorder.useMutation({
		onSettled: () => utils.board.get.invalidate({ boardId }),
	});

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

	const [active, setActive] = useState<ActiveDrag>(null);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	function onDragStart(e: DragStartEvent) {
		const id = String(e.active.id);
		const kind = e.active.data.current?.kind as "task" | "column" | undefined;
		if (kind === "task") {
			const t = tasks.find((x) => x.id === id);
			if (t) setActive({ kind: "task", task: t });
		} else if (kind === "column") {
			const c = columns.find((x) => x.id === id);
			if (c) setActive({ kind: "column", column: c });
		}
	}

	function onDragEnd(e: DragEndEvent) {
		setActive(null);
		const { active: a, over } = e;
		if (!over) return;
		const activeKind = a.data.current?.kind as "task" | "column" | undefined;

		if (activeKind === "column") {
			const overKind = over.data.current?.kind as "task" | "column" | undefined;
			const overColumnId =
				overKind === "column"
					? String(over.id)
					: (over.data.current?.columnId as string | undefined);
			if (!overColumnId || overColumnId === a.id) return;

			const sorted = [...columns].sort((x, y) => x.position - y.position);
			const fromIdx = sorted.findIndex((c) => c.id === a.id);
			const toIdx = sorted.findIndex((c) => c.id === overColumnId);
			if (fromIdx === -1 || toIdx === -1) return;
			const without = sorted.filter((c) => c.id !== a.id);
			const insertAt = toIdx > fromIdx ? toIdx : toIdx;
			const before = without[insertAt - 1]?.position ?? null;
			const after = without[insertAt]?.position ?? null;
			reorderColumn.mutate({
				boardId,
				columnId: String(a.id),
				before,
				after,
			});
			return;
		}

		if (activeKind === "task") {
			const overKind = over.data.current?.kind as "task" | "column" | undefined;
			const targetColumnId =
				overKind === "column"
					? String(over.id)
					: ((over.data.current?.columnId as string | undefined) ??
						String(over.id));
			if (!targetColumnId) return;

			const activeTask = tasks.find((t) => t.id === a.id);
			if (!activeTask) return;

			const columnTasks = [...(tasksByColumn.get(targetColumnId) ?? [])].filter(
				(t) => t.id !== a.id,
			);

			let before: number | null = null;
			let after: number | null = null;

			if (overKind === "task") {
				const overIdx = columnTasks.findIndex((t) => t.id === over.id);
				if (overIdx === -1) {
					before = columnTasks[columnTasks.length - 1]?.position ?? null;
				} else {
					// Place above the hovered task by default
					before = columnTasks[overIdx - 1]?.position ?? null;
					after = columnTasks[overIdx]?.position ?? null;
				}
			} else {
				before = columnTasks[columnTasks.length - 1]?.position ?? null;
			}

			if (
				activeTask.columnId === targetColumnId &&
				before === activeTask.position
			) {
				return;
			}

			moveTask.mutate({
				boardId,
				taskId: activeTask.id,
				toColumnId: targetColumnId,
				before,
				after,
			});
		}
	}

	const sortedColumns = useMemo(
		() => [...columns].sort((a, b) => a.position - b.position),
		[columns],
	);

	return (
		<main className="flex h-[calc(100vh-57px)] flex-col">
			<div className="flex items-center justify-between border-white/5 border-b px-6 py-3">
				<h1 className="font-semibold text-xl">{projectName}</h1>
				{access.canAdmin ? (
					<ShareDialog boardId={boardId} projectId={projectId} />
				) : null}
			</div>
			<DndContext
				collisionDetection={closestCorners}
				onDragEnd={canWrite ? onDragEnd : undefined}
				onDragStart={canWrite ? onDragStart : undefined}
				sensors={sensors}
			>
				<div className="flex-1 overflow-x-auto">
					<div className="flex h-full min-w-max gap-4 p-6">
						<SortableContext
							items={sortedColumns.map((c) => c.id)}
							strategy={horizontalListSortingStrategy}
						>
							{sortedColumns.map((col) => (
								<SortableColumn
									boardId={boardId}
									canWrite={canWrite}
									column={col}
									key={col.id}
									onOpenTask={setOpenTaskId}
									tasks={tasksByColumn.get(col.id) ?? []}
								/>
							))}
						</SortableContext>
						{canWrite ? <AddColumn boardId={boardId} /> : null}
					</div>
				</div>
				<DragOverlay>
					{active?.kind === "task" ? (
						<TaskCardPreview task={active.task} />
					) : active?.kind === "column" ? (
						<div className="w-72 rounded-xl bg-white/[0.06] p-3 shadow-xl">
							<div className="font-medium text-sm">{active.column.name}</div>
						</div>
					) : null}
				</DragOverlay>
			</DndContext>
			<TaskDetailSheet
				boardId={boardId}
				canWrite={canWrite}
				labels={labels}
				onOpenChange={(o) => {
					if (!o) setOpenTaskId(null);
				}}
				open={!!openTask}
				projectId={projectId}
				task={openTask}
				taskLabels={taskLabels}
			/>
		</main>
	);
}

function SortableColumn({
	boardId,
	column,
	tasks,
	canWrite,
	onOpenTask,
}: {
	boardId: string;
	column: ColumnRow;
	tasks: TaskRow[];
	canWrite: boolean;
	onOpenTask: (taskId: string) => void;
}) {
	const sortable = useSortable({
		id: column.id,
		data: { kind: "column" },
		disabled: !canWrite,
	});
	const { setNodeRef: setDropRef } = useDroppable({
		id: `col-drop-${column.id}`,
		data: { kind: "column", columnId: column.id },
	});

	const style = {
		transform: CSS.Translate.toString(sortable.transform),
		transition: sortable.transition,
		opacity: sortable.isDragging ? 0.4 : 1,
	};

	return (
		<div
			className="flex w-72 shrink-0 flex-col gap-3 rounded-xl bg-white/[0.03] p-3"
			ref={sortable.setNodeRef}
			style={style}
		>
			<ColumnHeader
				boardId={boardId}
				canWrite={canWrite}
				column={column}
				dragHandleProps={{
					...sortable.attributes,
					...sortable.listeners,
				}}
				taskCount={tasks.length}
			/>
			<div className="flex flex-col gap-2" ref={setDropRef}>
				<SortableContext
					items={tasks.map((t) => t.id)}
					strategy={verticalListSortingStrategy}
				>
					{tasks.map((t) => (
						<SortableTaskCard
							boardId={boardId}
							canWrite={canWrite}
							columnId={column.id}
							key={t.id}
							onOpen={() => onOpenTask(t.id)}
							task={t}
						/>
					))}
				</SortableContext>
				{tasks.length === 0 ? (
					<div className="h-2 rounded-md border border-white/5 border-dashed" />
				) : null}
			</div>
			{canWrite ? <AddTask boardId={boardId} columnId={column.id} /> : null}
		</div>
	);
}

function ColumnHeader({
	boardId,
	column,
	canWrite,
	taskCount,
	dragHandleProps,
}: {
	boardId: string;
	column: ColumnRow;
	canWrite: boolean;
	taskCount: number;
	dragHandleProps: React.HTMLAttributes<HTMLButtonElement>;
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
		onSuccess: () => utils.board.get.invalidate({ boardId }),
		onError: (e) => toast.error(e.message),
	});

	return (
		<div className="flex items-center gap-1 px-1">
			{canWrite ? (
				<button
					aria-label="Drag column"
					className="cursor-grab text-white/40 hover:text-white/80 active:cursor-grabbing"
					type="button"
					{...dragHandleProps}
				>
					<GripVertical className="h-4 w-4" />
				</button>
			) : null}
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
					<span className="ml-2 text-white/40 text-xs">{taskCount}</span>
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
	);
}

function SortableTaskCard({
	boardId,
	task,
	columnId,
	canWrite,
	onOpen,
}: {
	boardId: string;
	task: TaskRow;
	columnId: string;
	canWrite: boolean;
	onOpen: () => void;
}) {
	const sortable = useSortable({
		id: task.id,
		data: { kind: "task", columnId },
		disabled: !canWrite,
	});

	const style = {
		transform: CSS.Translate.toString(sortable.transform),
		transition: sortable.transition,
		opacity: sortable.isDragging ? 0.3 : 1,
	};

	return (
		<div
			ref={sortable.setNodeRef}
			style={style}
			{...sortable.attributes}
			{...sortable.listeners}
		>
			<TaskCard boardId={boardId} onOpen={onOpen} task={task} />
		</div>
	);
}

function TaskCardPreview({ task }: { task: TaskRow }) {
	return (
		<div className="w-72 rotate-2 rounded-lg border border-white/10 bg-[#14151c] p-3 shadow-xl">
			<p className="text-sm leading-snug">{task.title}</p>
		</div>
	);
}

function TaskCard({
	boardId,
	task,
	onOpen,
}: {
	boardId: string;
	task: TaskRow;
	onOpen: () => void;
}) {
	const utils = api.useUtils();
	const remove = api.task.delete.useMutation({
		onSuccess: () => utils.board.get.invalidate({ boardId }),
	});
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: dnd-kit sortable wrapper handles keyboard focus and activation
		// biome-ignore lint/a11y/noStaticElementInteractions: draggable surface
		<div
			className="group w-full cursor-pointer rounded-lg border border-white/5 bg-[#14151c] p-3 transition hover:border-white/15"
			onClick={onOpen}
		>
			<div className="flex items-start justify-between gap-2">
				<p className="text-sm leading-snug">{task.title}</p>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="opacity-0 group-hover:opacity-100"
							onPointerDown={(e) => e.stopPropagation()}
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
