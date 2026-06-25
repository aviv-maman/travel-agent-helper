"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { FeeLevel } from "@/lib/cancellations";
import { FeeTable, type FeeTableRow } from "./fee-table";

/**
 * The client script is stored as plain text (it's copied verbatim to the
 * customer): an opening Consumer Protection Law clause, then one `timeframe — fee`
 * tier per paragraph. We parse the tiers into table rows for display (coloring
 * each by the supplied severity level) while the copy button still sends the
 * original full text.
 */
function parseTiers(text: string, levels: FeeLevel[]): FeeTableRow[] {
  return text
    .split(/\n\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1) // drop the opening law clause (shown once at the top of the page)
    .map((line, i) => {
      const dash = line.indexOf(" — ");
      const row =
        dash === -1
          ? { timeframe: line, fee: "" }
          : { timeframe: line.slice(0, dash).trim(), fee: line.slice(dash + 3).trim() };
      return { ...row, level: levels[i] };
    });
}

/** The ready-to-send client script: title + fee table + copy button. */
export function CopyScript({ text, levels = [] }: { text: string; levels?: FeeLevel[] }) {
  const t = useTranslations("cancellations");
  const [copied, setCopied] = useState(false);
  const rows = parseTiers(text, levels);

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
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-destructive uppercase">
        {t("copyTitle")}
      </p>

      <FeeTable headers={[t("copyTimeHeader"), t("copyFeeHeader")]} rows={rows} />

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
