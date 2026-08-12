export default function DocsLoading() {
  return (
    <main className="flex h-[calc(100vh-57px)] animate-pulse">
      <div className="hidden w-64 border-r border-white/10 bg-white/[0.015] p-4 md:block">
        <div className="h-8 rounded-md bg-white/5" />
        <div className="mt-6 space-y-2">
          <div className="h-6 rounded bg-white/[0.04]" />
          <div className="ml-4 h-6 rounded bg-white/[0.04]" />
          <div className="h-6 rounded bg-white/[0.04]" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-4xl p-8 md:p-14">
        <div className="h-4 w-40 rounded bg-white/5" />
        <div className="mt-6 h-10 w-2/3 rounded bg-white/5" />
        <div className="mt-10 space-y-3">
          <div className="h-4 rounded bg-white/[0.04]" />
          <div className="h-4 w-5/6 rounded bg-white/[0.04]" />
        </div>
      </div>
    </main>
  );
}
