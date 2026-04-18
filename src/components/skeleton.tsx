import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-[#2a2a2d]", className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="bg-[#1b1b1e] ghost-border rounded-xl p-5 space-y-3">
      <Skeleton className="h-2.5 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-2.5 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-[#0e0e11] ghost-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[rgba(73,69,78,0.15)]">
        <Skeleton className="h-2.5 w-32" />
      </div>
      <div className="divide-y divide-[rgba(73,69,78,0.08)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            {Array.from({ length: cols - 1 }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={cn("grid gap-4", count === 4 ? "grid-cols-2 lg:grid-cols-4" : count === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2")}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function FDCardSkeleton() {
  return (
    <div className="bg-[#1b1b1e] ghost-border rounded-xl p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-l-2 border-[#2a2a2d] pl-3 space-y-1.5">
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-16" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-2.5 w-32 mx-auto" />
      </div>
    </div>
  );
}
