"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { refreshNews } from "@/app/actions/news";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RefreshNewsButton() {
  const t = useTranslations("news");
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      try {
        await refreshNews();
        toast.success(t("refreshed"));
      } catch {
        toast.error(t("refreshError"));
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={refresh}>
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
      {pending ? t("refreshing") : t("refresh")}
    </Button>
  );
}
