import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback for the hotels page. The page awaits the
 * destination list (and, when a destination is selected, the filtered hotel
 * view) before rendering — this shows instantly on first navigation. Filter
 * and pagination changes stay on the same segment inside the router's
 * transition, so this fallback does not re-flash on them. Mirrors the real
 * layout: destination combobox, an alert strip and a few result cards. See
 * ./page.tsx.
 */
export default function HotelsLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Destination combobox */}
      <Skeleton className="h-11 w-full rounded-md" />

      {/* Info / warning alert strip */}
      <Skeleton className="h-16 w-full rounded-xl" />

      {/* Result cards */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
