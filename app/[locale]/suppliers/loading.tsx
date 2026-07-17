import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback for the suppliers (commissions) page. The page
 * awaits the commission rows and shared contacts before rendering — this shows
 * instantly on navigation. Mirrors the real layout: legend, search box,
 * category tabs and the two-column card grid. See ./page.tsx and
 * components/commissions/commissions-view.tsx.
 */
export default function SuppliersLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Commission-percent legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>

      {/* Search box */}
      <Skeleton className="h-11 w-full rounded-md" />

      {/* Category tabs */}
      <Skeleton className="h-9 w-80 max-w-full rounded-xl" />

      {/* Supplier card grid */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
