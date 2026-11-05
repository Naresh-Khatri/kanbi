export default function Loading() {
  return (
    <main className="h-below-header flex flex-col">
      <div className="flex gap-4 p-6">
        {[0, 1, 2].map((i) => (
          <div
            className="h-64 w-72 shrink-0 animate-pulse rounded-lg bg-white/5"
            key={i}
          />
        ))}
      </div>
    </main>
  );
}
