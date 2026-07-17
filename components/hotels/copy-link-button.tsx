"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ url, className }: { url: string; className?: string }) {
  const t = useTranslations("hotels.card");
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={className}
      title={t("copyLink")}
      aria-label={t("copyLink")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast.success(t("copied"));
        } catch {
          toast.error(t("copyLink"));
        }
      }}>
      <Copy />
    </Button>
  );
}
