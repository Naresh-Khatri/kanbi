export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-6">
        <div className="h-8 w-40 animate-pulse rounded bg-white/5" />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li
              className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.02]"
              key={i}
            />
          ))}
        </ul>
      </div>
    </main>
  );
}
