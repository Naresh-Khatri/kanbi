import { PageContainer } from "@/components/ui/surface";

export default function Loading() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="h-8 w-40 animate-pulse rounded-md bg-white/5" />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li
              className="h-32 animate-pulse rounded-lg border border-white/10 bg-white/5"
              key={i}
            />
          ))}
        </ul>
      </div>
    </PageContainer>
  );
}
