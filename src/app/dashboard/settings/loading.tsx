import { Skeleton } from "@/components/skeleton";

export default function SettingsLoading() {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-80" />
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          <Skeleton className="h-5 w-24 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
