import { CardGridSkeleton, TableSkeleton, Skeleton } from "@/components/skeleton";

export default function OverviewLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-56" />
      </div>
      <CardGridSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <Skeleton className="h-3 w-36" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <div className="space-y-1.5 text-right">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
