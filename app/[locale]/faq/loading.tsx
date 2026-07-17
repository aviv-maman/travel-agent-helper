import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback for the FAQ page. The page awaits the FAQ
 * rows before rendering — this shows instantly on navigation. Mirrors the
 * real layout: intro line, search box and the question cards. See ./page.tsx
 * and components/faq/faq-view.tsx.
 */
export default function FaqLoading() {
  return (
    <div className="flex flex-col gap-4">
      {/* Intro line */}
      <Skeleton className="h-4 w-3/4" />

      {/* Search box */}
      <Skeleton className="h-11 w-full rounded-md" />

      {/* Question cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}
