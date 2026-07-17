import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback for the transfers page. The page awaits the
 * transfer rows (grouped by country) before rendering — this shows instantly
 * on navigation. Mirrors the real layout: intro strip, search box and a couple
 * of country sections with city rows. See ./page.tsx and
 * components/transfers/transfers-view.tsx.
 */
export default function TransfersLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Intro strip */}
      <Skeleton className="h-14 w-full rounded-xl" />

      {/* Search box */}
      <Skeleton className="h-11 w-full rounded-md" />

      {/* Country sections */}
      {Array.from({ length: 2 }).map((_, s) => (
        <div key={s}>
          <div className="mb-2.5 flex items-center gap-2 border-b border-border pb-1.5">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border-t border-border px-3 py-2.5 first:border-t-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
