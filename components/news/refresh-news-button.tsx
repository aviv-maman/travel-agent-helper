"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { refreshNews } from "@/app/actions/news";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SubmitButton() {
  const t = useTranslations("news");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
      {pending ? t("refreshing") : t("refresh")}
    </Button>
  );
}

export function RefreshNewsButton() {
  return (
    <form action={refreshNews}>
      <SubmitButton />
    </form>
  );
}
