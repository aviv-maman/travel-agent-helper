"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { WhatsAppIcon } from "./whatsapp-icon";

/** Client phone shown with a copy button and a WhatsApp send button. */
export function PhoneActions({ phone }: { phone: string }) {
  const t = useTranslations("dashboard.task");
  const digits = phone.replace(/\D/g, "");
  const waHref = `https://wa.me/${digits}`;

  function copy() {
    navigator.clipboard.writeText(phone).then(
      () => toast.success(t("phoneCopied")),
      () => toast.error(t("phoneCopied")),
    );
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-surface-2/40 py-0.5 ps-2 pe-0.5">
      <Phone className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      <span dir="ltr" className="font-mono text-xs text-foreground">
        {phone}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("copyPhone")}
        onClick={copy}>
        <Copy className="size-3.5" />
      </Button>
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        aria-label={t("whatsapp")}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-xs" }),
          "text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366]",
        )}>
        <WhatsAppIcon className="size-4" />
      </a>
    </div>
  );
}
