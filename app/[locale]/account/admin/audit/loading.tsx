import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallback for the admin audit tab. The page awaits the audit rows
 * before rendering — this keeps the account tabs responsive by showing an
 * instant skeleton of the audit card in the content area. See ./page.tsx.
 */
export default function AdminAuditLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3.5 w-56" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
