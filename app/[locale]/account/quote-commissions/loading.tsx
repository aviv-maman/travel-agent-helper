import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallback for the quote-commissions tab. The page awaits the quote
 * supplier rows before rendering — this keeps the account tabs responsive by
 * showing an instant skeleton of the table card in the content area. Uses the
 * same desktop breakout width as the real card so nothing jumps when the data
 * lands. See ./page.tsx.
 */
export default function QuoteCommissionsLoading() {
  return (
    <Card className="lg:mx-[calc((100%-min(72rem,92vw))/2)] lg:w-[min(72rem,92vw)]">
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3.5 w-72" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-surface px-3 py-3">
            <Skeleton className="h-4 w-2/3" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-t border-border px-3 py-3 first:border-t-0">
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-3 w-80 max-w-full" />
      </CardContent>
    </Card>
  );
}
