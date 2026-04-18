import { CardGridSkeleton, TableSkeleton, Skeleton } from "@/components/skeleton";

export default function ZerodhaLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-56" />
      </div>
      <CardGridSkeleton count={4} />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
