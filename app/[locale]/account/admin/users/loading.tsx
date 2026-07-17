import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallback for the admin users tab. The page awaits the paginated
 * user list before rendering — this keeps the account tabs responsive by
 * showing an instant skeleton of the search card and users table in the
 * content area. See ./page.tsx.
 */
export default function AdminUsersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3.5 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-full max-w-xs rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
          <Skeleton className="h-3 w-28" />
        </CardContent>
      </Card>

      {/* Users table */}
      <div className="overflow-hidden rounded-xl border border-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-t border-border px-3 py-3 first:border-t-0">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
