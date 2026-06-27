"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import type { ViewSupplier } from "@/lib/commissions";
import { Input } from "@/components/ui/input";
import { CommissionCard } from "./commission-card";

const LEGEND: { dot: string; key: "high" | "mid" | "low" | "net" }[] = [
  { dot: "bg-success", key: "high" },
  { dot: "bg-brand", key: "mid" },
  { dot: "bg-warning", key: "low" },
  { dot: "bg-destructive", key: "net" },
];

export function CommissionsView({ suppliers }: { suppliers: ViewSupplier[] }) {
  const t = useTranslations("commissions");
  const [query, setQuery] = useState("");

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = suppliers.filter((s) => tokens.every((tok) => s.search.includes(tok)));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {LEGEND.map(({ dot, key }) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`size-2.5 rounded-full ${dot}`} aria-hidden />
            {t(`legend.${key}`)}
          </span>
        ))}
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
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {filtered.map((s) => (
            <CommissionCard key={s.id} supplier={s} />
          ))}
        </div>
      )}
    </div>
  );
}
