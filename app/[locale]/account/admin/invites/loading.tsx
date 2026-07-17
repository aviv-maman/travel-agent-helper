import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallback for the admin invites tab. The page awaits the invite
 * list before rendering — this keeps the account tabs responsive by showing
 * an instant skeleton of the create-invite card and invites table in the
 * content area. See ./page.tsx.
 */
export default function AdminInvitesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3.5 w-64" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-9 w-full max-w-sm rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </CardContent>
      </Card>

      {/* Invites table */}
      <div className="overflow-hidden rounded-xl border border-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-t border-border px-3 py-3 first:border-t-0">
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
