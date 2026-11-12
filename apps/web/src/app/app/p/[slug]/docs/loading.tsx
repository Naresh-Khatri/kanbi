import { Skeleton } from "@/components/ui/skeleton";

export default function DocsLoading() {
  return (
    <main className="h-below-header bg-background flex">
      <div className="bg-sidebar hidden w-64 flex-col gap-2 border-e p-3 md:flex">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-2 h-7 w-full rounded-lg" />
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="ms-4 h-5 w-3/5" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-10 md:px-10 md:py-14">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-2/3" />
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </main>
  );
}
