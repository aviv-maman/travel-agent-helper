import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallback for the admin user-detail page. The page awaits the user
 * record and their active sessions before rendering — this keeps the account
 * tabs responsive by showing an instant skeleton of the breadcrumb, profile
 * card and sessions card in the content area. See ./page.tsx.
 */
export default function UserDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-4 w-16" />
        <span aria-hidden className="text-muted-foreground">
          /
        </span>
        <Skeleton className="h-4 w-24" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5 px-3 py-2.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-52" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
