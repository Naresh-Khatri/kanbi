import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <div className="flex w-72 shrink-0 flex-col gap-2" key={i}>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ))}
      </div>
    </main>
  );
}
