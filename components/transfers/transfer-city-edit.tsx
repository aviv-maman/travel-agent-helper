"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Localized, PillVariant, TransferPill } from "@/db/schema";
import type { ViewCityRow } from "@/lib/transfers";
import { saveTransferCityPillsAction } from "@/app/actions/transfers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type SupplierOption = { slug: string; name: Localized; code: string };

/** "—" = the supplier is not mentioned on this destination's row. */
type PillState = "none" | PillVariant;
type Mode = "all" | "custom";

const STATES: readonly PillState[] = ["none", "yes", "no", "warn"];
const STATE_STYLE: Record<PillState, string> = {
  none: "data-[active=true]:bg-muted data-[active=true]:text-foreground",
  yes: "data-[active=true]:bg-success/15 data-[active=true]:text-success",
  no: "data-[active=true]:bg-destructive/15 data-[active=true]:text-destructive",
  warn: "data-[active=true]:bg-gold/15 data-[active=true]:text-gold",
};
const STATE_SYMBOL: Record<PillState, string> = { none: "—", yes: "✓", no: "✗", warn: "⚠" };

const ALL_LABEL: Localized = { he: "כל הספקים", en: "All suppliers" };
const REST_LABEL: Localized = { he: "שאר הספקים", en: "Other suppliers" };

/** A pill whose label marks it as the generic "all suppliers" chip. */
function isAllPill(p: TransferPill): boolean {
  return (p.label.he ?? "").includes("כל הספקים") || /all suppliers/i.test(p.label.en ?? "");
}
/** A pill whose label marks it as the generic "other/rest suppliers" chip. */
function isRestPill(p: TransferPill): boolean {
  return (p.label.he ?? "").includes("שאר") || /other suppliers/i.test(p.label.en ?? "");
}

/** Four-state segmented control (— / ✓ / ✗ / ⚠). */
function StatePicker({
  value,
  onChange,
  labels,
}: {
  value: PillState;
  onChange: (_next: PillState) => void;
  labels: Record<PillState, string>;
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-border" role="group">
      {STATES.map((s) => (
        <button
          key={s}
          type="button"
          data-active={value === s}
          title={labels[s]}
          aria-label={labels[s]}
          aria-pressed={value === s}
          onClick={() => onChange(s)}
          className={`border-s border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors first:border-s-0 hover:text-foreground ${STATE_STYLE[s]}`}>
          {STATE_SYMBOL[s]}
        </button>
      ))}
    </div>
  );
}

export function TransferCityEdit({
  city,
  suppliers,
}: {
  city: ViewCityRow;
  suppliers: SupplierOption[];
}) {
  const t = useTranslations("transfers.editor");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const pick = (v: Localized) => (locale === "he" ? (v.he ?? v.en) : (v.en ?? v.he)) ?? "";

  // Two suppliers can share a display name (e.g. שטיח מעופף / flying-sp) —
  // disambiguate with the supplier's short code chip.
  const displayName = (s: SupplierOption) => {
    const dup = suppliers.some((o) => o.slug !== s.slug && pick(o.name) === pick(s.name));
    return dup ? `${pick(s.name)} (${s.code})` : pick(s.name);
  };

  // Reconstruct the dialog state from the stored pills. Pills whose label
  // doesn't match any supplier (e.g. אופיר טורס, which isn't in the suppliers
  // table) become editable "extra" rows so nothing is silently dropped.
  const initial = useMemo(() => {
    const pills = city.rawPills;
    const allPill = pills.find(isAllPill);
    const none: { label: Localized; tooltip?: Localized; state: PillState }[] = [];
    if (pills.length === 1 && allPill) {
      // "verify" isn't offered for all-suppliers — fall back to "included".
      return {
        mode: "all" as Mode,
        allVariant: allPill.variant === "warn" ? "yes" : allPill.variant,
        per: {},
        rest: "none" as PillState,
        extras: none,
      };
    }
    const per: Record<string, PillState> = {};
    const extras: { label: Localized; tooltip?: Localized; state: PillState }[] = [];
    let rest: PillState = "none";
    for (const p of pills) {
      if (isRestPill(p) || isAllPill(p)) {
        rest = p.variant;
        continue;
      }
      const sup = suppliers.find((s) => {
        const heMatch =
          p.label.he && (s.name.he === p.label.he || `${s.name.he} (${s.code})` === p.label.he);
        const enMatch =
          p.label.en && (s.name.en === p.label.en || `${s.name.en} (${s.code})` === p.label.en);
        return heMatch || enMatch;
      });
      if (sup && !(sup.slug in per)) per[sup.slug] = p.variant;
      else if (!sup) extras.push({ label: p.label, tooltip: p.tooltip, state: p.variant });
    }
    return { mode: "custom" as Mode, allVariant: "yes" as PillVariant, per, rest, extras };
  }, [city.rawPills, suppliers]);

  const [mode, setMode] = useState<Mode>(initial.mode);
  const [allVariant, setAllVariant] = useState<PillVariant>(initial.allVariant);
  const [per, setPer] = useState<Record<string, PillState>>(initial.per);
  const [rest, setRest] = useState<PillState>(initial.rest);
  const [extras, setExtras] = useState(initial.extras);

  const stateLabels: Record<PillState, string> = {
    none: t("stateNone"),
    yes: t("stateYes"),
    no: t("stateNo"),
    warn: t("stateWarn"),
  };

  function reset() {
    setMode(initial.mode);
    setAllVariant(initial.allVariant);
    setPer(initial.per);
    setRest(initial.rest);
    setExtras(initial.extras);
  }

  async function save() {
    let pills: TransferPill[];
    if (mode === "all") {
      pills = [{ variant: allVariant, label: ALL_LABEL }];
    } else {
      pills = suppliers
        .filter((s) => (per[s.slug] ?? "none") !== "none")
        .map((s) => {
          const dup = suppliers.some((o) => o.slug !== s.slug && pick(o.name) === pick(s.name));
          const label: Localized = dup
            ? {
                ...(s.name.he ? { he: `${s.name.he} (${s.code})` } : {}),
                ...(s.name.en ? { en: `${s.name.en} (${s.code})` } : {}),
              }
            : s.name;
          return { variant: per[s.slug] as PillVariant, label };
        });
      for (const ex of extras) {
        if (ex.state === "none") continue;
        pills.push({
          variant: ex.state as PillVariant,
          label: ex.label,
          ...(ex.tooltip ? { tooltip: ex.tooltip } : {}),
        });
      }
      if (rest !== "none") pills.push({ variant: rest, label: REST_LABEL });
      if (pills.length === 0) {
        toast.error(t("atLeastOne"));
        return;
      }
    }
    if (city.dbId == null) return;
    setSaving(true);
    const res = await saveTransferCityPillsAction(city.dbId, pills);
    setSaving(false);
    if ("error" in res) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("saved"));
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("edit")}
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="ms-auto shrink-0 text-muted-foreground hover:text-foreground">
        <Pencil className="size-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-start">{t("title", { city: city.name })}</DialogTitle>
          </DialogHeader>

          {/* Only the (long) per-supplier list needs to scroll. In "all
              suppliers" mode the body is just the two radios, so keep it
              content-sized — `flex-1` would otherwise force a stray scrollbar. */}
          <div
            className={`-mx-4 border-t border-border px-4 pt-3 ${
              mode === "custom" ? "min-h-0 flex-1 overflow-y-auto" : ""
            }`}>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
              className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
                <RadioGroupItem value="all" />
                {t("modeAll")}
              </label>

              {mode === "all" && (
                <div className="ms-6 mb-1 flex items-center gap-2">
                  {(["yes", "no"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      data-active={allVariant === v}
                      aria-pressed={allVariant === v}
                      onClick={() => setAllVariant(v)}
                      className={`rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground ${STATE_STYLE[v]}`}>
                      {STATE_SYMBOL[v]} {stateLabels[v]}
                    </button>
                  ))}
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
                <RadioGroupItem value="custom" />
                {t("modeCustom")}
              </label>
            </RadioGroup>

            {mode === "custom" && (
              <div className="ms-6 mt-2 flex flex-col">
                {suppliers.map((s) => (
                  <div
                    key={s.slug}
                    className="flex items-center justify-between gap-2 border-t border-border/60 py-1.5 first:border-t-0">
                    <Label className="truncate text-sm text-foreground">{displayName(s)}</Label>
                    <StatePicker
                      value={per[s.slug] ?? "none"}
                      onChange={(v) => setPer((p) => ({ ...p, [s.slug]: v }))}
                      labels={stateLabels}
                    />
                  </div>
                ))}
                {extras.map((ex, i) => (
                  <div
                    key={`extra-${i}`}
                    className="flex items-center justify-between gap-2 border-t border-border/60 py-1.5">
                    <Label className="truncate text-sm text-foreground">{pick(ex.label)}</Label>
                    <StatePicker
                      value={ex.state}
                      onChange={(v) =>
                        setExtras((xs) => xs.map((x, xi) => (xi === i ? { ...x, state: v } : x)))
                      }
                      labels={stateLabels}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 border-t border-border py-1.5">
                  <Label className="truncate text-sm font-semibold text-foreground">
                    {t("restSuppliers")}
                  </Label>
                  <StatePicker value={rest} onChange={setRest} labels={stateLabels} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row justify-end border-t border-border pt-3">
            <Button type="button" onClick={save} disabled={saving}>
              {t("save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
