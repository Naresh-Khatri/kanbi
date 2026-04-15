export default function Loading() {
	return (
		<main className="flex h-[calc(100vh-57px)] flex-col">
			<div className="flex items-center justify-between border-white/5 border-b px-6 py-3">
				<div className="h-6 w-40 animate-pulse rounded bg-white/5" />
			</div>
			<div className="flex gap-4 p-6">
				{[0, 1, 2].map((i) => (
					<div
						className="h-64 w-72 shrink-0 animate-pulse rounded-xl bg-white/[0.03]"
						key={i}
					/>
				))}
			</div>
		</main>
	);
}
