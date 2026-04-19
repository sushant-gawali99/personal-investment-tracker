import { CardGridSkeleton, Skeleton } from "@/components/skeleton";

export default function OverviewLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3.5 w-56" />
      </div>
      <CardGridSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="ab-card p-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="ab-card p-6 space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="ab-card p-6 space-y-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="ab-card p-6 space-y-3">
          <Skeleton className="h-4 w-36" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-[#2a2a2e] last:border-0">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="space-y-1.5 text-right">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
