"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ url }: { url: string }) {
  const t = useTranslations("hotels.card");
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground"
      title={t("copyLink")}
      aria-label={t("copyLink")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast.success(t("copied"));
        } catch {
          toast.error(t("copyLink"));
        }
      }}
    >
      <Copy className="size-3.5" />
    </Button>
  );
}
