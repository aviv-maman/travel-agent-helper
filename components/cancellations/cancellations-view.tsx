"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { InfoIcon, Plus, TriangleAlertIcon, Search, X } from "lucide-react";
import type { EditableCancel, ViewCancelSupplier } from "@/lib/cancellations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CancelCard } from "./cancel-card";
import { LawCalculator } from "./law-calculator";
import { CancellationCreateWizard } from "./cancellation-create-wizard";

export function CancellationsView({
  suppliers,
  canEdit,
  editable,
  signUrl,
}: {
  suppliers: ViewCancelSupplier[];
  canEdit?: boolean;
  /** Raw bilingual blocks + markup keyed by supplier slug (editors only). */
  editable?: Record<string, EditableCancel> | null;
  /** Presign base for the create wizard's logo upload; null hides upload. */
  signUrl?: string | null;
}) {
  const t = useTranslations("cancellations");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = suppliers.filter((s) => tokens.every((tok) => s.search.includes(tok)));

  return (
    <div className="flex flex-col gap-4">
      {creating && (
        <CancellationCreateWizard signUrl={signUrl ?? null} onClose={() => setCreating(false)} />
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
        {canEdit && editable && (
          <Button
            type="button"
            size="lg"
            className="h-11 shrink-0"
            onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t("create.addSupplier")}</span>
          </Button>
        )}
      </div>

      {/* Generic alerts — shown once for the whole list. */}
      <Alert className="border-gold/35 bg-gold/10 text-gold">
        <TriangleAlertIcon />
        <AlertTitle>{t("introTitle")}</AlertTitle>
        <AlertDescription className="text-gold">
          <p>
            {t.rich("intro", {
              strong: (chunks) => <strong className="font-bold">{chunks}</strong>,
            })}
          </p>
        </AlertDescription>
      </Alert>

      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>{t("lawTitle")}</AlertTitle>
        <AlertDescription>
          <p className="leading-relaxed">
            {t.rich("law", {
              strong: (chunks) => <strong className="font-bold">{chunks}</strong>,
              u: (chunks) => <u>{chunks}</u>,
            })}
          </p>
        </AlertDescription>
      </Alert>

      {/* Sits under the law text it implements: the dates that clause turns on. */}
      <LawCalculator />

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface/50 px-5 py-8 text-center text-sm text-muted-foreground">
          {t("noResults")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((s) => (
            <CancelCard
              key={s.id}
              supplier={s}
              canEdit={canEdit}
              editable={editable?.[s.id] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
