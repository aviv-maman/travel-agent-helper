"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import type { PillVariant, ViewCountryGroup } from "@/lib/transfers";
import { Input } from "@/components/ui/input";
import { CountryFlag } from "@/components/country-flag";

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

export function TransfersView({ groups }: { groups: ViewCountryGroup[] }) {
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
          <div className="flex flex-col gap-2.5">
            {grp.cities.map((city) => (
              <article
                key={city.id}
                className="rounded-xl border border-border bg-surface px-4 py-3">
                <h3 className="mb-2 text-sm font-bold text-foreground">{city.name}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {city.pills.map((pill, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL[pill.variant].className}`}>
                      {pill.flag && <span aria-hidden>{pill.flag}</span>}
                      <span aria-hidden>{PILL[pill.variant].symbol}</span>
                      {pill.label}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
