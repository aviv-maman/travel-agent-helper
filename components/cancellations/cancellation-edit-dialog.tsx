"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, X, Check } from "lucide-react";
import type { CancelBlock, CancelMarkup, Fee, FeeLevel, Localized } from "@/db/schema";
import {
  blocksToSections,
  categoriesToSections,
  feeText,
  markupFee,
  newSub,
  sectionsToCategories,
  DEFAULT_MARKUP,
  type EditCategory,
  type EditRow,
  type EditSub,
} from "@/lib/cancellations-edit";
import { saveCancellationAction } from "@/app/actions/cancellations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FeeMode = "percent" | "usd" | "eur";
const feeMode = (f: Fee): FeeMode | "text" =>
  f.kind === "percent" ? "percent" : f.kind === "text" ? "text" : f.currency;

// Hide the native number-input spinner arrows.
const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const LEVELS: FeeLevel[] = ["low", "net", "gross", "full"];
const LEVEL_DOT: Record<FeeLevel, string> = {
  low: "bg-success",
  net: "bg-brand",
  gross: "bg-gold",
  full: "bg-destructive",
};

/** A supplier's full cancellation card, edited category-by-category. Navigation:
 *  main category (heading) → sub-category (subheading) → the section's rows. New
 *  categories / sub-categories can be added. */
export function CancellationEditDialog({
  slug,
  name,
  blocks,
  markup,
  onClose,
}: {
  slug: string;
  name: string;
  blocks: CancelBlock[];
  markup: CancelMarkup | null;
  onClose: () => void;
}) {
  const t = useTranslations("cancellations");
  const locale = useLocale() as "he" | "en";
  const router = useRouter();
  const loc = (v: Localized | null | undefined) => (v ? (locale === "he" ? v.he : v.en) ?? "" : "");

  const [rule, setRule] = useState<CancelMarkup>(markup ?? DEFAULT_MARKUP);
  const [cats, setCats] = useState<EditCategory[]>(() =>
    sectionsToCategories(blocksToSections(blocks)),
  );
  const [catIdx, setCatIdx] = useState(0);
  const [subIdx, setSubIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const ci = Math.min(catIdx, cats.length - 1);
  const cat = cats[ci];
  const si = Math.min(subIdx, cat.subs.length - 1);
  const sub = cat.subs[si];

  // ── immutable updaters for the current category / sub ──────────────────────
  const patchCat = (patch: Partial<EditCategory>) =>
    setCats((prev) => prev.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const patchSub = (patch: Partial<EditSub>) =>
    setCats((prev) =>
      prev.map((c, i) =>
        i === ci ? { ...c, subs: c.subs.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : c,
      ),
    );
  const setRows = (updater: (_rows: EditRow[]) => EditRow[]) => patchSub({ rows: updater(sub.rows) });
  const setRow = (ri: number, patch: Partial<EditRow>) =>
    setRows((rows) => rows.map((r, i) => (i === ri ? { ...r, ...patch } : r)));

  function setMode(ri: number, mode: FeeMode) {
    const cur = sub.rows[ri].fee;
    const numVal = cur.kind === "percent" || cur.kind === "amount" ? cur.value : 0;
    const suffix = cur.kind === "amount" ? cur.suffix : undefined;
    const next: Fee =
      mode === "percent"
        ? { kind: "percent", value: numVal }
        : { kind: "amount", currency: mode, value: numVal, suffix };
    setRow(ri, { fee: next });
  }

  const addRow = () =>
    setRows((rows) => [
      ...rows,
      { timeframe: { he: "", en: "" }, fee: { kind: "percent", value: 0 }, level: "net" },
    ]);

  const addCategory = () => {
    setCats((prev) => [...prev, { heading: { he: "", en: "" }, subs: [newSub()] }]);
    setCatIdx(cats.length);
    setSubIdx(0);
  };
  const addSubCategory = () => {
    const next = cat.subs.length;
    patchCat({ subs: [...cat.subs, newSub({ text: { he: "", en: "" }, tone: "accent" })] });
    setSubIdx(next);
  };

  async function save() {
    if (saving) return;
    setSaving(true);
    const res = await saveCancellationAction(slug, rule, categoriesToSections(cats));
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error === "forbidden" ? t("edit.forbidden") : t("edit.saveFailed"));
      return;
    }
    toast.success(t("edit.saved"));
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("edit.title", { name })}</DialogTitle>
          <DialogDescription className="sr-only">{t("edit.title", { name })}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto pe-1">
          {/* Markup rule — applies when generating the client copy. */}
          <div className="rounded-lg border border-brand/30 bg-brand/5 p-3">
            <p className="mb-2 text-xs font-bold text-brand">{t("edit.markupLabel")}</p>
            <div className="flex flex-wrap gap-3">
              <RuleInput
                label={t("edit.markupPoints")}
                unit="%"
                value={rule.points}
                onChange={(v) => setRule((r) => ({ ...r, points: v }))}
              />
              <RuleInput
                label={t("edit.markupDollars")}
                unit="$"
                value={rule.dollars}
                onChange={(v) => setRule((r) => ({ ...r, dollars: v }))}
              />
              <RuleInput
                label={t("edit.markupEuros")}
                unit="€"
                value={rule.euros}
                onChange={(v) => setRule((r) => ({ ...r, euros: v }))}
              />
            </div>
          </div>

          {/* Category navigation + add. */}
          <div className="flex flex-wrap items-end gap-3">
            {cats.length > 1 && (
              <div className="flex min-w-[11rem] flex-1 flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{t("edit.mainCategory")}</Label>
                <Select
                  value={String(ci)}
                  onValueChange={(v) => {
                    setCatIdx(Number(v));
                    setSubIdx(0);
                  }}
                  items={Object.fromEntries(
                    cats.map((c, i) => [String(i), loc(c.heading) || t("edit.generalCategory")]),
                  )}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cats.map((c, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {loc(c.heading) || t("edit.generalCategory")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {cat.subs.length > 1 && (
              <div className="flex min-w-[11rem] flex-1 flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{t("edit.subCategory")}</Label>
                <Select
                  value={String(si)}
                  onValueChange={(v) => setSubIdx(Number(v))}
                  items={Object.fromEntries(
                    cat.subs.map((s, i) => [
                      String(i),
                      loc(s.subheading?.text) || loc(s.caption) || `#${i + 1}`,
                    ]),
                  )}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cat.subs.map((s, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {loc(s.subheading?.text) || loc(s.caption) || `#${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addCategory}>
                <Plus className="size-3.5" /> {t("edit.addCategory")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addSubCategory}>
                <Plus className="size-3.5" /> {t("edit.addSubCategory")}
              </Button>
            </div>
          </div>

          {/* Editable category + sub-category names. */}
          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[11rem] flex-1 flex-col gap-1">
              <Label className="text-[0.7rem] text-muted-foreground">
                {t("edit.categoryName")} <span className="opacity-70">({t("edit.optional")})</span>
              </Label>
              <Input
                dir="rtl"
                className="h-8 text-sm"
                value={cat.heading?.he ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  patchCat({ heading: v.trim() ? { he: v, en: v } : null });
                }}
              />
            </div>
            <div className="flex min-w-[11rem] flex-1 flex-col gap-1">
              <Label className="text-[0.7rem] text-muted-foreground">
                {t("edit.subCategoryName")}{" "}
                <span className="opacity-70">({t("edit.optional")})</span>
              </Label>
              <Input
                dir="rtl"
                className="h-8 text-sm"
                value={sub.subheading?.text.he ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  patchSub({
                    subheading: v.trim()
                      ? { text: { he: v, en: v }, tone: sub.subheading?.tone ?? "accent" }
                      : null,
                  });
                }}
              />
            </div>
          </div>

          {/* Rows for the selected section. */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-destructive">{loc(sub.caption)}</p>
            {sub.rows.map((row, ri) => {
              const mode = feeMode(row.fee);
              const client = feeText(markupFee(row.fee, rule), locale);
              const sym = mode === "percent" ? "%" : mode === "usd" ? "$" : mode === "eur" ? "€" : "";
              return (
                <div key={ri} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
                  <div className="flex items-start gap-2">
                    {/* Timeframe (Hebrew only) */}
                    <div className="flex flex-1 flex-col gap-1">
                      <Label className="text-[0.7rem] text-muted-foreground">
                        {t("edit.timeframe")}
                      </Label>
                      <Input
                        dir="rtl"
                        className="h-8 text-sm"
                        value={row.timeframe.he ?? ""}
                        onChange={(e) =>
                          setRow(ri, { timeframe: { he: e.target.value, en: e.target.value } })
                        }
                      />
                    </div>

                    {/* Fee (left in RTL) */}
                    <div className="flex w-[11rem] flex-col gap-1">
                      <Label className="text-[0.7rem] text-muted-foreground">{t("edit.fee")}</Label>
                      <div className="flex gap-1">
                        {(["percent", "usd", "eur"] as FeeMode[]).map((mo) => (
                          <button
                            key={mo}
                            type="button"
                            onClick={() => setMode(ri, mo)}
                            className={`flex h-8 flex-1 items-center justify-center rounded-md border text-xs font-semibold transition-colors ${
                              mode === mo
                                ? "border-brand bg-brand text-brand-foreground"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}>
                            {mo === "percent" ? "%" : mo === "usd" ? "$" : "€"}
                          </button>
                        ))}
                      </div>
                      {row.fee.kind === "text" ? (
                        <Input
                          dir="rtl"
                          className="mt-1.5 h-8 text-sm"
                          value={row.fee.label.he ?? ""}
                          onChange={(e) =>
                            setRow(ri, {
                              fee: { kind: "text", label: { he: e.target.value, en: e.target.value } },
                            })
                          }
                        />
                      ) : (
                        <div className="relative mt-1.5" dir="ltr">
                          {/* The chosen sign sits next to the amount, updated live. */}
                          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm font-semibold text-muted-foreground">
                            {sym}
                          </span>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            dir="ltr"
                            className={`h-8 pr-7 text-end text-sm ${NO_SPINNER}`}
                            value={
                              row.fee.kind === "percent" || row.fee.kind === "amount"
                                ? String(row.fee.value)
                                : ""
                            }
                            onChange={(e) => {
                              const value = Math.max(0, Math.round(Number(e.target.value) || 0));
                              if (row.fee.kind === "percent")
                                setRow(ri, { fee: { ...row.fee, value } });
                              else if (row.fee.kind === "amount")
                                setRow(ri, { fee: { ...row.fee, value } });
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Level + remove */}
                    <div className="flex flex-col gap-1">
                      <Label className="text-[0.7rem] text-muted-foreground">{t("edit.level")}</Label>
                      <Select
                        value={row.level}
                        onValueChange={(v) => setRow(ri, { level: v as FeeLevel })}>
                        <SelectTrigger className="h-8 w-16 px-2">
                          <span className={`size-2.5 rounded-full ${LEVEL_DOT[row.level]}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {LEVELS.map((lv) => (
                            <SelectItem key={lv} value={lv}>
                              <span className="flex items-center gap-2">
                                <span className={`size-2.5 rounded-full ${LEVEL_DOT[lv]}`} />
                                {t(`edit.level_${lv}`)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("edit.removeRow")}
                        disabled={sub.rows.length <= 1}
                        onClick={() => setRows((rows) => rows.filter((_, i) => i !== ri))}
                        className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  {/* Live client-copy preview */}
                  <p className="text-xs text-muted-foreground">
                    {t("edit.clientPreview")} <span className="font-semibold text-brand">{client}</span>
                  </p>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addRow}
              className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand">
              <Plus className="me-1 inline size-3.5" /> {t("edit.addRow")}
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onClose}>
            <X className="size-4 text-destructive" /> {t("edit.cancel")}
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={save}>
            <Check className="size-4" /> {saving ? t("edit.saving") : t("edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleInput({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (_v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[0.7rem] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{unit}</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={String(value)}
          onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          className={`h-8 w-20 text-sm ${NO_SPINNER}`}
        />
      </div>
    </div>
  );
}
