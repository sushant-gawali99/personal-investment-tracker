import { CardGridSkeleton, FDCardSkeleton, Skeleton } from "@/components/skeleton";

export default function FDLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
      <CardGridSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <FDCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
