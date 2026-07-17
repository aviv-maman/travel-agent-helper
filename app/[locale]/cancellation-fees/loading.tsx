import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback for the cancellation-fees page. The page
 * awaits the cancellation rows before rendering — this shows instantly on
 * navigation. Mirrors the real layout: search box, the two intro alerts and
 * the supplier card list. See ./page.tsx and
 * components/cancellations/cancellations-view.tsx.
 */
export default function CancellationsLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Search box */}
      <Skeleton className="h-11 w-full rounded-md" />

      {/* Intro + law alerts */}
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />

      {/* Supplier cards */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
