export default function Loading() {
  return (
    <main className="flex h-[calc(100vh-57px)] flex-col">
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
