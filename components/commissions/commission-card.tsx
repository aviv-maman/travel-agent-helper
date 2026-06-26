import { useTranslations } from "next-intl";
import { Luggage, TriangleAlert, OctagonAlert } from "lucide-react";
import type { CommColor, CommLevel, BaggageIcon, ViewSupplier } from "@/lib/commissions";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { RichText } from "./rich-text";
import { SupplierContact } from "./supplier-contact";

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
  bag: { glyph: "", className: "" },
  ok: { glyph: "✓", className: "text-success" },
  warn: { glyph: "⚠", className: "text-gold" },
  flight: { glyph: "✈️", className: "" },
  package: { glyph: "🏖️", className: "" },
  tour: { glyph: "🧳", className: "" },
};

export function CommissionCard({ supplier }: { supplier: ViewSupplier }) {
  const t = useTranslations("commissions");

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <header className="flex items-center gap-3 border-b border-border bg-surface-2/40 px-4 py-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-xl shadow-sm ring-1 ring-border/50 ${CHIP[supplier.color]}`}
          aria-hidden>
          {supplier.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base leading-tight font-bold text-foreground">
            {supplier.name}
          </h3>
          {supplier.alias && (
            <p className="truncate text-xs leading-snug text-muted-foreground">{supplier.alias}</p>
          )}
        </div>
        <SupplierContact supplierId={supplier.id} supplierName={supplier.name} />
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

        <Alert variant="info" className="mt-2.5">
          <Luggage />
          <AlertTitle>{t("baggage")}</AlertTitle>
          <AlertDescription className="col-start-1 col-span-2">
            <ul className="flex flex-col gap-1.5">
              {supplier.baggage.map((row, i) => {
                const icon = BAG_ICON[row.icon];
                return (
                  <li key={i} className="flex items-start gap-2 leading-snug">
                    {icon.glyph && (
                      <span className={`shrink-0 ${icon.className}`} aria-hidden>
                        {icon.glyph}
                      </span>
                    )}
                    <span className="text-foreground">
                      <RichText text={row.text} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </Alert>

        {supplier.note &&
          (supplier.noteVariant === "red" ? (
            <Alert variant="destructive" className="mt-2.5">
              <OctagonAlert />
              <AlertTitle>{t("noteError")}</AlertTitle>
              <AlertDescription className="col-start-1 col-span-2 text-xs leading-relaxed">
                <p>
                  <RichText text={supplier.note} />
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="warning" className="mt-2.5">
              <TriangleAlert />
              <AlertTitle>{t("noteWarning")}</AlertTitle>
              <AlertDescription className="col-start-1 col-span-2 text-xs leading-relaxed">
                <p>
                  <RichText text={supplier.note} />
                </p>
              </AlertDescription>
            </Alert>
          ))}
      </div>
    </article>
  );
}
