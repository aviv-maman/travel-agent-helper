"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { refreshNews } from "@/app/actions/refresh-news";
import { useCan } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Admin-only "refresh news" control. Hidden unless the user holds
 * `news:revalidate`; the Server Action enforces the same check server-side.
 */
export function RefreshNewsButton() {
  const t = useTranslations("news");
  const router = useRouter();
  const [pending, start] = useTransition();
  const allowed = useCan("news:revalidate");

  if (!allowed) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await refreshNews();
          if (res.ok) router.refresh(); // pull the freshly-revalidated feed
        })
      }>
      <RefreshCw className={cn("size-4", pending && "animate-spin")} />
      {pending ? t("refreshing") : t("refresh")}
    </Button>
  );
}
