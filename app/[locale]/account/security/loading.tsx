import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallback for the security tab. The page awaits sessions, audit
 * activity and passkeys before rendering — this keeps the account tabs
 * responsive by showing an instant skeleton of the settings-card stack in the
 * content area. The account layout (and its tab nav) stays mounted around
 * this. See ./page.tsx.
 */
export default function SecurityLoading() {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-64" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-9 w-full max-w-sm rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
