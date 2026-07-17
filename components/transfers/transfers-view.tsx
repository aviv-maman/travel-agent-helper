"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import type { PillVariant, ViewCountryGroup } from "@/lib/transfers";
import { TransferCityEdit, type SupplierOption } from "./transfer-city-edit";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/country-flag";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PILL: Record<PillVariant, { symbol: string; className: string }> = {
  yes: {
    symbol: "✓",
    className: "border-success/25 bg-success/[0.12] text-success",
  },
  no: {
    symbol: "✗",
    className: "border-destructive/20 bg-destructive/[0.1] text-destructive",
  },
  warn: {
    symbol: "⚠",
    className: "border-gold/25 bg-gold/[0.1] text-gold",
  },
};

/** Matches an IATA/airport code in parentheses, e.g. "(SOF)" or "(ECN/GEC)". */
const CODE_RE = /\(([A-Z][A-Z/]+)\)/g;

/**
 * Render a city name, turning any parenthesized airport codes into blue badges
 * (same look as the hotels destination combobox).
 */
function renderName(name: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of name.matchAll(CODE_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(name.slice(last, i));
    parts.push(
      <Badge
        key={key++}
        variant="outline"
        className="mx-0.5 rounded-sm border-brand/35 bg-brand/10 px-1.5 text-[0.65rem] font-semibold tracking-wide text-brand">
        {m[1]}
      </Badge>,
    );
    last = i + m[0].length;
  }
  if (last < name.length) parts.push(name.slice(last));
  return parts;
}

export function TransfersView({
  groups,
  canEdit = false,
  suppliers = [],
}: {
  groups: ViewCountryGroup[];
  canEdit?: boolean;
  suppliers?: SupplierOption[];
}) {
  const t = useTranslations("transfers");
  const [query, setQuery] = useState("");

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const filtered = useMemo(() => {
    if (tokens.length === 0) return groups;
    return groups
      .map((grp) => ({
        ...grp,
        cities: grp.cities.filter((c) => tokens.every((tok) => c.search.includes(tok))),
      }))
      .filter((grp) => grp.cities.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, query]);

  const hasResults = filtered.length > 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-5">
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {t.rich("intro", {
            strong: (chunks) => <strong className="font-bold text-foreground">{chunks}</strong>,
          })}
        </p>

        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-11 ps-9 pe-9 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("clear")}
              className="absolute end-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive">
              <X className="size-4" />
            </button>
          )}
        </div>

        {!hasResults && (
          <p className="rounded-xl border border-dashed border-border bg-surface/50 px-5 py-8 text-center text-sm text-muted-foreground">
            {t("noResults")}
          </p>
        )}

        {filtered.map((grp) => (
          <section key={grp.id}>
            <h2 className="mb-2.5 flex items-center gap-2 border-b border-border pb-1.5 text-sm font-bold text-foreground">
              {grp.code ? (
                <CountryFlag code={grp.code} className="h-4 w-6" />
              ) : (
                <span aria-hidden>🌍</span>
              )}
              {grp.country}
            </h2>
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {grp.cities.flatMap((city) =>
                city.name.split("·").map((segment, si) => (
                  <div
                    key={`${city.id}-${si}`}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border px-3 py-2 first:border-t-0">
                    <span className="me-1 text-sm font-bold text-foreground">
                      {renderName(segment.trim())}
                    </span>
                    {city.pills.map((pill, i) => {
                      const content = (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL[pill.variant].className}`}>
                          {pill.flag && <span aria-hidden>{pill.flag}</span>}
                          <span aria-hidden>{PILL[pill.variant].symbol}</span>
                          {pill.label}
                        </span>
                      );
                      const tip =
                        pill.tooltip ?? (pill.variant === "warn" ? t("verifyTooltip") : null);
                      return tip ? (
                        <Tooltip key={i}>
                          <TooltipTrigger render={<button type="button" />}>
                            {content}
                          </TooltipTrigger>
                          <TooltipContent>{tip}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span key={i}>{content}</span>
                      );
                    })}
                    {canEdit && si === 0 && city.dbId != null && (
                      <TransferCityEdit city={city} suppliers={suppliers} />
                    )}
                  </div>
                )),
              )}
            </div>
          </section>
        ))}
      </div>
    </TooltipProvider>
  );
}
