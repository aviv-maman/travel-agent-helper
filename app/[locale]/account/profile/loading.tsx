import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallback for the profile tab. The page awaits the current user
 * (and, for admins, an admin count) before rendering — this keeps the account
 * tabs responsive by showing an instant skeleton of the profile card in the
 * content area. The account layout (and its tab nav) stays mounted around
 * this. See ./page.tsx.
 */
export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
          {/* Display-name form */}
          <Skeleton className="h-9 w-full max-w-sm rounded-md" />
          {/* Detail rows */}
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-24 rounded-md" />
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3.5 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-36 rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}
