"use client";

import { Eye } from "lucide-react";
import { useMemo } from "react";

import { api } from "@/trpc/react";

export function PublicBoardView({ token }: { token: string }) {
	const [data] = api.share.getPublic.useSuspenseQuery({ token });
	const { board, columns, tasks } = data;

	const tasksByColumn = useMemo(() => {
		const map = new Map<string, typeof tasks>();
		for (const c of columns) map.set(c.id, []);
		for (const t of tasks) {
			if (t.archivedAt) continue;
			map.get(t.columnId)?.push(t);
		}
		return map;
	}, [columns, tasks]);

	return (
		<main className="flex min-h-screen flex-col">
			<header className="sticky top-0 z-40 flex items-center justify-between border-white/5 border-b bg-[#0b0b0f]/80 px-6 py-3 backdrop-blur">
				<h1 className="font-semibold text-lg">{board.projectName}</h1>
				<div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-white/60 text-xs">
					<Eye className="h-3.5 w-3.5" /> View only
				</div>
			</header>
			<div className="flex-1 overflow-x-auto">
				<div className="flex min-w-max gap-4 p-6">
					{columns.map((col) => (
						<div
							className="flex w-72 shrink-0 flex-col gap-3 rounded-xl bg-white/[0.03] p-3"
							key={col.id}
						>
							<div className="flex items-center gap-2 px-1">
								<span className="font-medium text-sm">{col.name}</span>
								<span className="text-white/40 text-xs">
									{tasksByColumn.get(col.id)?.length ?? 0}
								</span>
							</div>
							<div className="flex flex-col gap-2">
								{(tasksByColumn.get(col.id) ?? []).map((t) => (
									<div
										className="rounded-lg border border-white/5 bg-[#14151c] p-3"
										key={t.id}
									>
										<p className="text-sm leading-snug">{t.title}</p>
										{t.priority !== "none" ? (
											<div className="mt-2 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 uppercase tracking-wide">
												{t.priority}
											</div>
										) : null}
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</main>
	);
}
