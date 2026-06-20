"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/** The ready-to-send client script: consumer-law banner + copy box + button. */
export function CopyScript({ text }: { text: string }) {
  const t = useTranslations("cancellations");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("copy"));
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {t("copyTitle")}
      </p>

      <div className="rounded-lg border border-purple/25 bg-purple/[0.07] px-3.5 py-2.5 text-sm leading-relaxed text-purple">
        {t.rich("law", {
          strong: (chunks) => <strong className="font-bold text-purple/90">{chunks}</strong>,
          u: (chunks) => <u>{chunks}</u>,
        })}
      </div>

      <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-foreground">
        {text}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
            copied
              ? "border-success/40 bg-success/15 text-success"
              : "border-border bg-surface-2 text-muted-foreground hover:border-brand/40 hover:text-brand"
          }`}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
    </div>
  );
}
