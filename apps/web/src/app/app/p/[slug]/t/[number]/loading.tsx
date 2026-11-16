import { Skeleton } from "@/components/ui/skeleton";

// overrides the board-column skeleton from p/[slug]/loading.tsx
export default function Loading() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div className="flex items-center gap-4" key={i}>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    </main>
  );
}
