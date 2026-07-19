"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search, X } from "lucide-react";
import type { EditableSupplier, SupplierCategory, ViewSupplier } from "@/lib/commissions";
import type { SupplierContact } from "@/lib/contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CommissionCard } from "./commission-card";
import { SupplierCreateWizard } from "./supplier-create-wizard";

const LEGEND: { dot: string; key: "high" | "mid" | "low" | "net" }[] = [
  { dot: "bg-success", key: "high" },
  { dot: "bg-brand", key: "mid" },
  { dot: "bg-warning", key: "low" },
  { dot: "bg-destructive", key: "net" },
];

const CATEGORIES: {
  value: SupplierCategory;
  key: "main" | "hotels" | "carRental" | "insurance";
  emoji: string;
}[] = [
  { value: "flights", key: "main", emoji: "✈️" },
  { value: "hotels", key: "hotels", emoji: "🏨" },
  { value: "car-rental", key: "carRental", emoji: "🚗" },
  { value: "insurance", key: "insurance", emoji: "🛡️" },
];

export function CommissionsView({
  suppliers,
  contacts,
  canEditContacts,
  editableSuppliers,
  signUrl,
}: {
  suppliers: ViewSupplier[];
  /** Shared contact records keyed by supplier slug (server-fetched). */
  contacts: Record<string, SupplierContact>;
  canEditContacts: boolean;
  /** Raw editable rows keyed by slug (editors with a DB only), else null. */
  editableSuppliers?: Record<string, EditableSupplier> | null;
  /** Presign endpoint base for the create wizard's logo upload; null hides it. */
  signUrl?: string | null;
}) {
  const t = useTranslations("commissions");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SupplierCategory>("flights");
  const [creating, setCreating] = useState(false);
  // Editors only (the raw editable rows are fetched for them).
  const canCreate = canEditContacts && editableSuppliers != null;

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const match = (s: ViewSupplier) => tokens.every((tok) => s.search.includes(tok));

  return (
    <div className="flex flex-col gap-5">
      {/* The commission-percent legend only applies to the main (flights) tab. */}
      {tab === "flights" && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {LEGEND.map(({ dot, key }) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`size-2.5 rounded-full ${dot}`} aria-hidden />
              {t(`legend.${key}`)}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
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
        {canCreate && (
          <Button type="button" size="lg" className="h-11 shrink-0" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t("create.addSupplier")}</span>
          </Button>
        )}
      </div>

      {creating && (
        <SupplierCreateWizard
          defaultCategory={tab}
          signUrl={signUrl ?? null}
          onClose={() => setCreating(false)}
        />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as SupplierCategory)}>
        <TabsList className="rounded-xl">
          {CATEGORIES.map(({ value, key, emoji }) => {
            const count = suppliers.filter((s) => s.category === value).length;
            return (
              <TabsTrigger key={value} value={value}>
                <span aria-hidden>{emoji}</span>
                {t(`categories.${key}`)}
                <Badge variant="secondary" className="ms-0.5">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORIES.map(({ value }) => {
          const list = suppliers.filter((s) => s.category === value && match(s));
          return (
            <TabsContent key={value} value={value} className="pt-3">
              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-surface/50 px-5 py-8 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                  {list.map((s) => (
                    <CommissionCard
                      key={s.id}
                      supplier={s}
                      contact={contacts[s.id]}
                      canEditContact={canEditContacts}
                      editable={editableSuppliers?.[s.id] ?? null}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
