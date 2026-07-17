import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback for the airlines page. The page awaits the
 * airline rows and shared contacts before rendering — this shows instantly on
 * navigation. Mirrors the real layout: two intro alerts, the table search box
 * and the baggage table. See ./page.tsx and
 * components/airline/airline-view.tsx.
 */
export default function AirlinesLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Intro + commission-note alerts */}
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />

      {/* Table search box */}
      <Skeleton className="h-11 w-full rounded-md" />

      {/* Data table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-surface px-3 py-3">
          <Skeleton className="h-4 w-2/3" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="border-t border-border px-3 py-3 first:border-t-0">
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
