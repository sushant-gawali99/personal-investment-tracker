import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-[#222226]", className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="ab-card p-5 space-y-3">
      <Skeleton className="h-2.5 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-2.5 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="ab-card overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a2a2e] bg-[#1c1c20]">
        <Skeleton className="h-2.5 w-32" />
      </div>
      <div className="divide-y divide-[#2a2a2e]">
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
    <div className="ab-card p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}
