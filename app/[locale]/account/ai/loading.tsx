import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallback for the AI settings tab. The page awaits a backend
 * credential lookup (and, on the free tier, a cold start) before rendering —
 * this keeps the account tabs responsive by showing an instant skeleton of the
 * API-key card in the content area while that resolves. The account layout (and
 * its tab nav) stays mounted around this. See ./page.tsx.
 */
export default function AiSettingsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-64" />
        </CardHeader>
        <CardContent className="flex max-w-md flex-col gap-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-3 w-52" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}
