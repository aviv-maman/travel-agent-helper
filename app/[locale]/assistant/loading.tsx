import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level Suspense fallback for the assistant page. The page is a server
 * component that awaits a backend credential check (and, on the free tier, a
 * cold start) before it can render — this renders instantly on navigation so
 * the tab never looks frozen. Mirrors the real layout: the chat card + a few
 * quote-history rows. See app/[locale]/assistant/page.tsx.
 */
export default function AssistantLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Chat card — matches ChatInterface's h-[60svh] rounded card. */}
      <div className="flex h-[60svh] flex-col overflow-hidden rounded-2xl border border-border bg-surface/40">
        {/* Header strip */}
        <div className="flex items-center gap-2 border-b border-border bg-card/40 px-3 py-2.5">
          <Skeleton className="size-7 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        {/* Body */}
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-3 w-40" />
        </div>
        {/* Composer */}
        <div className="border-t border-border bg-card/40 p-3">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>

      {/* Saved-quotes history */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
