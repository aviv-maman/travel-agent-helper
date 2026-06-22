import { useTranslations } from "next-intl";
import type { CommColor, CommLevel, BaggageIcon, ViewSupplier } from "@/lib/commissions";
import { RichText } from "./rich-text";

/** Icon-chip background + text color per supplier color token. */
const CHIP: Record<CommColor, string> = {
  brand: "bg-brand/15 text-brand",
  success: "bg-success/15 text-success",
  gold: "bg-gold/15 text-gold",
  warning: "bg-warning/15 text-warning",
  purple: "bg-purple/15 text-purple",
  destructive: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

/** Percentage color per commission level (matches the legend). */
const LEVEL: Record<CommLevel, string> = {
  high: "text-success",
  mid: "text-brand",
  low: "text-warning",
  range: "text-gold",
  net: "text-destructive",
};

/** Leading glyph + color for each baggage row type. */
const BAG_ICON: Record<BaggageIcon, { glyph: string; className: string }> = {
  bag: { glyph: "🎒", className: "" },
  money: { glyph: "$", className: "text-brand font-bold" },
  ok: { glyph: "✓", className: "text-success" },
  warn: { glyph: "⚠", className: "text-gold" },
};

export function CommissionCard({ supplier }: { supplier: ViewSupplier }) {
  const t = useTranslations("commissions");

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-lg ${CHIP[supplier.color]}`}
          aria-hidden>
          {supplier.emoji}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-foreground">{supplier.name}</h3>
          {supplier.alias && <p className="text-xs text-muted-foreground">{supplier.alias}</p>}
        </div>
      </header>

      <div className="flex flex-col px-4 py-3">
        {supplier.rates.map((rate, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
            <span className="text-sm text-muted-foreground">{rate.label}</span>
            <span
              className={`shrink-0 font-bold ${LEVEL[rate.level]} ${
                rate.level === "net" ? "text-sm" : "text-base"
              }`}>
              {rate.value}
            </span>
          </div>
        ))}

        <div className="mt-2.5 rounded-lg bg-surface-2 px-3 py-2.5">
          <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {t("baggage")}
          </p>
          <ul className="flex flex-col gap-1.5">
            {supplier.baggage.map((row, i) => {
              const icon = BAG_ICON[row.icon];
              return (
                <li key={i} className="flex items-start gap-2 text-sm leading-snug">
                  <span className={`shrink-0 ${icon.className}`} aria-hidden>
                    {icon.glyph}
                  </span>
                  <span className="text-foreground">
                    <RichText text={row.text} />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {supplier.note && (
          <div
            className={`mt-2.5 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
              supplier.noteVariant === "red"
                ? "border-destructive/25 bg-destructive/[0.07] text-destructive"
                : "border-gold/25 bg-gold/[0.07] text-gold"
            }`}>
            <RichText text={supplier.note} />
          </div>
        )}
      </div>
    </article>
  );
}
