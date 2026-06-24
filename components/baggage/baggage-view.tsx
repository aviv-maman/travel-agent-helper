"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Info, Search, X } from "lucide-react";
import type { WeightTier, ViewAirline } from "@/lib/baggage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CountryFlag } from "@/components/country-flag";
import { SupplierContact } from "@/components/commissions/supplier-contact";

const TIER: Record<WeightTier, string> = {
  kg23: "bg-success/[0.12] text-success",
  kg20: "bg-brand/[0.12] text-brand",
};

// Trolley badge — same chip style as the suitcase weight, in a non-green tone.
const TROLLEY_CHIP = "bg-gold/[0.12] text-gold";

export function BaggageView({ airlines }: { airlines: ViewAirline[] }) {
  const t = useTranslations("baggage");
  const [query, setQuery] = useState("");

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = airlines.filter((a) => tokens.every((tok) => a.search.includes(tok)));

  // Website link — disabled until airlines carry a website. The span wraps the
  // disabled button so the tooltip still shows on hover.
  const websiteButton = (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("website")}
          disabled
          className="text-muted-foreground">
          <Globe className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("website")}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-brand/25 bg-brand/[0.07] px-4 py-3 text-sm leading-relaxed text-brand">
          {t.rich("intro", {
            strong: (chunks) => <strong className="font-bold">{chunks}</strong>,
            br: () => <br />,
          })}
        </div>

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

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface/50 px-5 py-8 text-center text-sm text-muted-foreground">
            {t("noResults")}
          </p>
        ) : (
          <>
            {/* Mobile: stacked cards — a 4-column table is too cramped on phones. */}
            <ul className="flex flex-col gap-2 sm:hidden">
              {filtered.map((a, i) => (
                <li
                  key={i}
                  className={`flex flex-col gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 ${
                    a.highlight ? "bg-brand/[0.03]" : ""
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {a.iata && (
                        <span className="inline-block shrink-0 rounded border border-brand/25 bg-brand/10 px-1.5 font-mono text-[0.68rem] font-extrabold tracking-wide text-brand">
                          {a.iata}
                        </span>
                      )}
                      <span
                        className={`truncate text-sm ${
                          a.highlight ? "text-muted-foreground" : "text-foreground"
                        }`}>
                        {a.name}
                      </span>
                      {a.code && <CountryFlag code={a.code} className="shrink-0" />}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {a.info ? (
                        <Tooltip>
                          <TooltipTrigger
                            className={`inline-flex cursor-help items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold ${TIER[a.tier]}`}>
                            {a.weight}
                            <Info className="size-3.5 shrink-0" aria-hidden />
                          </TooltipTrigger>
                          <TooltipContent>{a.info}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${TIER[a.tier]}`}>
                          {a.weight}
                        </span>
                      )}
                      {a.note ? (
                        a.noteTone === "gold" ? (
                          <Tooltip>
                            <TooltipTrigger
                              className={`inline-flex h-5 cursor-help items-center justify-center rounded-md px-1.5 align-middle ${TROLLEY_CHIP}`}>
                              <Info className="size-3.5 shrink-0" aria-hidden />
                            </TooltipTrigger>
                            <TooltipContent>{a.note}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${TROLLEY_CHIP}`}>
                            {a.note}
                          </span>
                        )
                      ) : (
                        // Reserve the trolley chip's height so every card is the same height.
                        <span className="h-5" aria-hidden />
                      )}
                    </span>
                  </div>
                  {!a.highlight && (
                    <div className="flex items-center gap-1.5">
                      <SupplierContact supplierId={a.id} supplierName={a.name} />
                      {websiteButton}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Desktop: full table. */}
            <div className="hidden overflow-hidden rounded-xl border border-border bg-surface sm:block">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-2">
                    <th className="px-3 py-2 text-start text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      {t("colAirline")}
                    </th>
                    <th className="px-3 py-2 text-start text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      {t("colSuitcase")}
                    </th>
                    <th className="px-3 py-2 text-start text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      {t("colTrolley")}
                    </th>
                    <th className="px-3 py-2 text-start text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      {t("colContact")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr
                      key={i}
                      className={`border-t border-border transition-colors hover:bg-brand/[0.04] ${
                        a.highlight ? "bg-brand/[0.03]" : ""
                      }`}>
                      <td className="px-3 py-1.5 align-middle text-sm">
                        {a.iata && (
                          <span className="me-1.5 inline-block rounded border border-brand/25 bg-brand/10 px-1.5 align-middle font-mono text-[0.68rem] font-extrabold tracking-wide text-brand">
                            {a.iata}
                          </span>
                        )}
                        <span className={a.highlight ? "text-muted-foreground" : "text-foreground"}>
                          {a.name}
                        </span>
                        {a.code && <CountryFlag code={a.code} className="ms-1.5 align-middle" />}
                      </td>
                      <td className="px-3 py-1.5 align-middle">
                        {a.info ? (
                          <Tooltip>
                            <TooltipTrigger
                              className={`inline-flex h-5 cursor-help items-center gap-1 rounded-md px-1.5 align-middle text-xs font-bold ${TIER[a.tier]}`}>
                              {a.weight}
                              <Info className="size-3.5 shrink-0" aria-hidden />
                            </TooltipTrigger>
                            <TooltipContent>{a.info}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span
                            className={`inline-flex h-5 items-center rounded-md px-1.5 align-middle text-xs font-bold ${TIER[a.tier]}`}>
                            {a.weight}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 align-middle">
                        {a.note &&
                          (a.noteTone === "gold" ? (
                            <Tooltip>
                              <TooltipTrigger
                                className={`inline-flex h-5 cursor-help items-center justify-center rounded-md px-1.5 align-middle ${TROLLEY_CHIP}`}>
                                <Info className="size-3.5 shrink-0" aria-hidden />
                              </TooltipTrigger>
                              <TooltipContent>{a.note}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <span
                              className={`inline-flex h-5 items-center rounded-md px-1.5 align-middle text-xs font-bold ${TROLLEY_CHIP}`}>
                              {a.note}
                            </span>
                          ))}
                      </td>
                      <td className="px-3 py-1.5 align-middle">
                        {!a.highlight && (
                          <div className="flex items-center gap-1.5">
                            <SupplierContact supplierId={a.id} supplierName={a.name} />
                            {websiteButton}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
