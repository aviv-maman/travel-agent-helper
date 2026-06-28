import Image from "next/image";
import { useTranslations } from "next-intl";
import { Luggage, TriangleAlert, Info, Percent, Globe } from "lucide-react";
import type { CommLevel, BaggageIcon, ViewSupplier } from "@/lib/commissions";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { RichText } from "./rich-text";
import { SupplierContact } from "./supplier-contact";

/** Fallback logo shown until a supplier's own logo file is added. */
const PLACEHOLDER_LOGO = "/suppliers/placeholder-logo.svg";

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

/**
 * Fixed category rows always rendered in the baggage table — every supplier
 * shows the same three rows, matched to its baggage data by icon. Missing
 * categories render with an empty details cell.
 */
const TABLE_CATEGORIES = [
  { icon: "flight", labelKey: "flightsOnly" },
  { icon: "package", labelKey: "packages" },
  { icon: "tour", labelKey: "organizedTours" },
] as const;

export function CommissionCard({ supplier }: { supplier: ViewSupplier }) {
  const t = useTranslations("commissions");

  // Always render the same three category rows, pulling each supplier's matching
  // baggage details by icon. A category with no data shows an empty details cell.
  const tableRows = TABLE_CATEGORIES.map((cat) => {
    const details: string[] = [];
    for (const row of supplier.baggage) {
      if (row.icon !== cat.icon) continue;
      const sep = row.text.indexOf(":");
      const detail = sep === -1 ? row.text : row.text.slice(sep + 1).trim();
      if (detail) details.push(detail);
    }
    return { icon: cat.icon as BaggageIcon, label: t(cat.labelKey), details };
  });

  // When the card carries a warning alert, table detail cells get a "*" marker
  // tying them to the caveat below.
  const hasWarn = supplier.baggage.some((r) => r.icon === "warn");

  // Toggle the title on the blue "info" baggage alert (backpack line). Hidden for
  // now; flip to true to bring the "מידע" title back.
  const showBaggageInfoTitle = false;

  // Commission table: the three default categories, each followed by any custom
  // lines of the same type (matched by the emoji their label starts with), so
  // e.g. "✈️ Flights only" is immediately followed by "✈️ Flights only: Dubai".
  type CommRow = { glyph: string; label: string; value: string; level: CommLevel };
  const commissionRows: CommRow[] = [];
  const usedCustoms = new Set<number>();
  const categories = [
    { glyph: "✈️", label: t("flightsOnly"), value: supplier.flightsOnly },
    { glyph: "🏖️", label: t("packages"), value: supplier.packages },
    { glyph: "🧳", label: t("organizedTours"), value: supplier.organizedTours },
  ];
  for (const cat of categories) {
    if (cat.value) {
      commissionRows.push({ glyph: cat.glyph, label: cat.label, ...cat.value });
    }
    supplier.customCommissions.forEach((cm, i) => {
      if (cm.label.startsWith(cat.glyph)) {
        commissionRows.push({ glyph: "", label: cm.label, value: cm.value, level: cm.level });
        usedCustoms.add(i);
      }
    });
  }
  // Custom lines whose emoji doesn't match any default category go last.
  supplier.customCommissions.forEach((cm, i) => {
    if (!usedCustoms.has(i)) {
      commissionRows.push({ glyph: "", label: cm.label, value: cm.value, level: cm.level });
    }
  });

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <header className="flex items-center gap-3 border-b border-border bg-surface-2/40 px-4 py-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2 text-xl shadow-sm ring-1 ring-border/50"
          aria-hidden>
          <Image
            src={supplier.logo ?? PLACEHOLDER_LOGO}
            alt=""
            width={40}
            height={40}
            className="size-full object-contain"
          />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base leading-tight font-bold text-foreground">
            {supplier.name}
          </h3>
          {supplier.website && (
            <a
              href={supplier.website}
              target="_blank"
              className="mt-1.5 inline-flex max-w-full items-center gap-1 align-top text-sm font-medium leading-snug text-brand hover:underline">
              <Globe className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{t("website")}</span>
            </a>
          )}
        </div>
        <SupplierContact supplierId={supplier.id} supplierName={supplier.name} size="icon" />
      </header>

      <div className="flex flex-col p-3">
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-2">
            <Percent className="size-4 shrink-0 text-brand" aria-hidden />
            <span className="text-sm font-semibold text-foreground">{t("commissionsTitle")}</span>
          </div>
          <Table>
            <TableBody>
              {commissionRows.map((row, i) => (
                <TableRow key={i} className="hover:bg-muted/30">
                    <TableCell className="px-3 py-2 align-top text-sm font-medium whitespace-normal text-foreground">
                      <span className="flex items-center gap-1.5">
                        {row.glyph && (
                          <span className="shrink-0 text-base" aria-hidden>
                            {row.glyph}
                          </span>
                        )}
                        {row.label}
                      </span>
                    </TableCell>
                    <TableCell className="w-px px-3 py-2 text-end align-top whitespace-nowrap">
                      {row.value && (
                        <span className={`text-sm font-bold ${LEVEL[row.level]}`}>{row.value}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        {/* Commission-related notes sit between the commission and baggage tables. */}
        {supplier.notes.map((note, i) => (
          <Alert
            key={i}
            variant={note.variant === "info" ? "default" : "warning"}
            className="mt-2.5 gap-x-2 px-3 py-2 [&>svg]:size-3.5 has-[>svg]:grid-cols-[14px_1fr] has-[>svg]:gap-x-2">
            {note.variant === "info" ? <Info /> : <TriangleAlert />}
            {note.showTitle && (
              <AlertTitle className="text-xs font-semibold">
                {note.variant === "info" ? t("info") : t("warningTitle")}
              </AlertTitle>
            )}
            <AlertDescription className="text-xs leading-relaxed">
              <p>
                <RichText text={note.text} />
              </p>
            </AlertDescription>
          </Alert>
        ))}

        <div className="mt-2.5 overflow-hidden rounded-lg border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-2">
            <Luggage className="size-4 shrink-0 text-brand" aria-hidden />
            <span className="text-sm font-semibold text-foreground">{t("baggage")}</span>
          </div>

          <Table>
            <TableBody>
              {tableRows
                .filter((row) => row.details.length > 0)
                .map((row, i) => {
                  const icon = BAG_ICON[row.icon];
                  return (
                    <TableRow key={i} className="hover:bg-muted/30">
                      <TableCell className="w-px px-3 py-2 align-top text-sm font-medium whitespace-nowrap text-foreground">
                        <span className="flex items-center gap-1.5">
                          {icon.glyph && (
                            <span className={`shrink-0 text-base ${icon.className}`} aria-hidden>
                              {icon.glyph}
                            </span>
                          )}
                          {row.label}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2 align-top text-sm leading-snug whitespace-normal text-muted-foreground">
                        {row.details.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {row.details.map((d, j) => (
                              <span key={j} className="block">
                                <RichText text={d} />
                                {hasWarn && j === row.details.length - 1 && (
                                  <span className="font-bold text-warning"> *</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        {/* Baggage-related alerts sit below the baggage table. */}
        {supplier.baggage
          .filter((r) => r.icon === "warn")
          .map((row, i) => (
            <div
              key={i}
              className="mt-2.5 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-warning">{t("warningTitle")}</span>
                <span className="text-xs leading-snug text-warning">
                  <RichText text={row.text} />
                </span>
              </div>
            </div>
          ))}

        {supplier.baggage
          .filter((r) => r.icon === "ok")
          .map((row, i) => (
            <div
              key={i}
              className="mt-2.5 flex items-start gap-2 rounded-lg border border-gold/35 bg-gold/10 px-3 py-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-gold">{t("warningTitle")}</span>
                <span className="text-xs leading-snug text-gold">
                  <RichText text={row.text} />
                </span>
              </div>
            </div>
          ))}

        {supplier.baggage
          .filter((r) => r.icon === "bag")
          .map((row, i) => (
            <div
              key={i}
              className="mt-2.5 flex items-start gap-2 rounded-lg border border-brand/30 bg-brand/8 px-3 py-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
              <div className="flex flex-col gap-0.5">
                {showBaggageInfoTitle && (
                  <span className="text-xs font-semibold text-brand">{t("info")}</span>
                )}
                <span className="text-xs leading-snug text-brand">
                  <RichText text={row.text} />
                </span>
              </div>
            </div>
          ))}
      </div>
    </article>
  );
}
