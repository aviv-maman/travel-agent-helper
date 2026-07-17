import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback for the dashboard. The page awaits tasks,
 * scratchpad, bank details and the news feed before rendering — this shows
 * instantly on navigation so the workspace never looks frozen. Mirrors the
 * real layout: greeting, tab bar, scratchpad and the task board. See
 * ./page.tsx and components/dashboard/dashboard-view.tsx.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Greeting */}
      <Skeleton className="h-7 w-64" />

      {/* Tab bar (Workspace / Bank / News) */}
      <Skeleton className="h-9 w-72 rounded-xl" />

      {/* Scratchpad */}
      <Skeleton className="h-28 w-full rounded-xl" />

      {/* Task board sections */}
      <div className="flex flex-col gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
