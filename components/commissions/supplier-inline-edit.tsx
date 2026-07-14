"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { BaggageIcon, CommissionKind, CommLevel, Localized } from "@/db/schema";
import type { BaggageRow, EditableCommissionRow } from "@/lib/commissions";
import {
  saveSupplierBaggageAction,
  saveSupplierCommissionsAction,
} from "@/app/actions/suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Inline (no modal) editors for a supplier card's two sections. The pencil
 * swaps the section body for editable rows (new rows are added from inside
 * the editor). Editing needs the database (the no-DB fallback is read-only)
 * and `content:edit` — the server actions re-check.
 */

type T = ReturnType<typeof useTranslations<"commissions.editor">>;

const LEVELS: CommLevel[] = ["high", "mid", "low", "range", "net"];
const STANDARD_KINDS: Exclude<CommissionKind, "custom">[] = [
  "flights",
  "packages",
  "organized",
];
// `bag` (the backpack line) is hardcoded in the card and not editable.
type EditorIcon = Exclude<BaggageIcon, "bag">;
/** Product categories with structured inclusion editing. */
const CATEGORY_ICONS: EditorIcon[] = ["flight", "package", "village", "tour"];
/** Free-text note rows ("important note" alerts) — edited as before. */
const NOTE_ICONS: EditorIcon[] = ["ok", "warn"];
const EDITOR_ICONS: EditorIcon[] = [...CATEGORY_ICONS, ...NOTE_ICONS];

const isCategory = (icon: BaggageIcon) => (CATEGORY_ICONS as BaggageIcon[]).includes(icon);

const KIND_KEY = { flights: "kindFlights", packages: "kindPackages", organized: "kindOrganized", custom: "kindCustom" } as const;
const LEVEL_KEY = { high: "levelHigh", mid: "levelMid", low: "levelLow", range: "levelRange", net: "levelNet" } as const;
const ICON_KEY = {
  flight: "iconFlight",
  package: "iconPackage",
  village: "iconVillage",
  tour: "iconTour",
  ok: "iconOk",
  warn: "iconWarn",
} as const satisfies Record<EditorIcon, string>;

/** The pencil shown at the end of a section header for editors. */
export function SectionEditButton({
  onEdit,
  disabled,
}: {
  onEdit: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("commissions.editor");
  return (
    <span className="ms-auto flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("edit")}
        disabled={disabled}
        onClick={onEdit}
        className="text-muted-foreground hover:text-foreground">
        <Pencil className="size-3.5" />
      </Button>
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[0.65rem] font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function EditorShell({
  onSave,
  onCancel,
  saving,
  addLabel,
  onAdd,
  t,
  children,
}: {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  addLabel: string;
  onAdd: () => void;
  t: T;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 p-2.5">
      {children}
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand">
        ➕ {addLabel}
      </button>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          {t("cancel")}
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}

// ── Commissions ───────────────────────────────────────────────────────────────

type CommissionDraft = {
  kind: CommissionKind;
  labelHe: string;
  labelEn: string;
  valueHe: string;
  valueEn: string;
  level: CommLevel;
};

function toCommissionDrafts(rows: EditableCommissionRow[]): CommissionDraft[] {
  return rows.map((r) => ({
    kind: r.kind,
    labelHe: r.label?.he ?? "",
    labelEn: r.label?.en ?? "",
    valueHe: r.value.he ?? "",
    valueEn: r.value.en ?? "",
    level: r.level,
  }));
}

/** The first standard kind not present yet, else a custom line. */
function nextKind(drafts: CommissionDraft[]): CommissionKind {
  return STANDARD_KINDS.find((k) => !drafts.some((d) => d.kind === k)) ?? "custom";
}

function newCommissionDraft(drafts: CommissionDraft[]): CommissionDraft {
  return { kind: nextKind(drafts), labelHe: "", labelEn: "", valueHe: "", valueEn: "", level: "mid" };
}

export function CommissionsEditor({
  slug,
  initial,
  onDone,
}: {
  slug: string;
  initial: EditableCommissionRow[];
  onDone: () => void;
}) {
  const t = useTranslations("commissions.editor");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<CommissionDraft[]>(() => toCommissionDrafts(initial));

  const update = (i: number, patch: Partial<CommissionDraft>) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));
  const add = () => setDrafts((d) => [...d, newCommissionDraft(d)]);

  /** Kinds this row may use: its own, unused standard ones, and custom. */
  function kindOptions(i: number): CommissionKind[] {
    const others = drafts.filter((_, idx) => idx !== i);
    return [...STANDARD_KINDS.filter((k) => !others.some((o) => o.kind === k)), "custom"];
  }

  async function save() {
    const rows: EditableCommissionRow[] = drafts
      .filter((d) => d.valueHe.trim() || d.valueEn.trim())
      .map((d) => ({
        kind: d.kind,
        label:
          d.kind === "custom" ? { he: d.labelHe.trim(), en: d.labelEn.trim() } : null,
        value: { he: d.valueHe.trim(), en: d.valueEn.trim() },
        level: d.level,
      }));
    if (rows.some((r) => r.kind === "custom" && !r.label?.he && !r.label?.en)) {
      toast.error(t("customNeedsLabel"));
      return;
    }
    setSaving(true);
    const res = await saveSupplierCommissionsAction(slug, rows);
    setSaving(false);
    if ("error" in res) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("commissionsSaved"));
    onDone();
    router.refresh();
  }

  return (
    <EditorShell onSave={save} onCancel={onDone} saving={saving} addLabel={t("addCommission")} onAdd={add} t={t}>
      {drafts.map((d, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-2">
          <div className="flex items-end gap-2">
            <Field label={t("kind")}>
              {/* `items` gives the closed trigger the translated label (Base UI
                  otherwise renders the raw value). */}
              <Select
                value={d.kind}
                onValueChange={(v) => update(i, { kind: v as CommissionKind })}
                items={Object.fromEntries(kindOptions(i).map((k) => [k, t(KIND_KEY[k])]))}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kindOptions(i).map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(KIND_KEY[k])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("level")}>
              <Select
                value={d.level}
                onValueChange={(v) => update(i, { level: v as CommLevel })}
                items={Object.fromEntries(LEVELS.map((l) => [l, t(LEVEL_KEY[l])]))}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {t(LEVEL_KEY[l])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("remove")}
              onClick={() => remove(i)}
              className="shrink-0 text-muted-foreground hover:text-destructive">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
          {d.kind === "custom" && (
            <div className="flex gap-2">
              <Field label={t("labelHe")}>
                <Input
                  value={d.labelHe}
                  dir="rtl"
                  onChange={(e) => update(i, { labelHe: e.target.value })}
                  className="h-8 text-xs"
                />
              </Field>
              <Field label={t("labelEn")}>
                <Input
                  value={d.labelEn}
                  dir="ltr"
                  onChange={(e) => update(i, { labelEn: e.target.value })}
                  className="h-8 text-xs"
                />
              </Field>
            </div>
          )}
          <div className="flex gap-2">
            <Field label={t("valueHe")}>
              <Input
                value={d.valueHe}
                dir="rtl"
                placeholder="7.5%"
                onChange={(e) => update(i, { valueHe: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>
            <Field label={t("valueEn")}>
              <Input
                value={d.valueEn}
                dir="ltr"
                placeholder="7.5%"
                onChange={(e) => update(i, { valueEn: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>
          </div>
        </div>
      ))}
    </EditorShell>
  );
}

// ── Baggage ───────────────────────────────────────────────────────────────────

type InclusionStatus = "included" | "not_included";
type PriceKind = "gross" | "net";

type BaggageDraft = {
  icon: BaggageIcon;
  /** Free text — note rows (ok/warn), and the legacy passthrough for category rows. */
  textHe: string;
  textEn: string;
  /** Structured fields for category rows. */
  status: InclusionStatus;
  price: string;
  priceKind: PriceKind;
  /** Row was already structured (has `inclusion`) when loaded. */
  structured: boolean;
  /** Structured fields touched — the text will be regenerated on save. */
  dirty: boolean;
};

/** The display text (both locales) a structured category row generates. */
function inclusionText(d: BaggageDraft): Localized {
  if (d.status === "included") {
    return { he: "מזוודה וטרולי כלולים", en: "Suitcase & trolley included" };
  }
  const price = d.price.trim();
  return {
    he: `מזוודה וטרולי לא כלולים — **${price} ${d.priceKind === "gross" ? "ברוטו" : "נטו"}**`,
    en: `Suitcase & trolley not included — **${price} ${d.priceKind === "gross" ? "gross" : "net"}**`,
  };
}

export function BaggageEditor({
  slug,
  initial,
  onDone,
}: {
  slug: string;
  initial: BaggageRow[];
  onDone: () => void;
}) {
  const t = useTranslations("commissions.editor");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<BaggageDraft[]>(() =>
    initial
      // The backpack line is hardcoded in the card now — legacy `bag` rows are
      // not editable and get dropped on the next save.
      .filter((r) => r.icon !== "bag")
      .map((r) => ({
        icon: r.icon,
        textHe: r.text.he ?? "",
        textEn: r.text.en ?? "",
        // Legacy free-text rows: sniff a sensible default for the controls.
        status: r.inclusion?.status ?? ((r.text.he ?? "").includes("לא כלול") ? "not_included" : "included"),
        price: r.inclusion?.price ?? "",
        priceKind: r.inclusion?.priceKind ?? "gross",
        structured: Boolean(r.inclusion),
        dirty: false,
      })),
  );

  const update = (i: number, patch: Partial<BaggageDraft>) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  /** Structured-field change: also marks the row for text regeneration. */
  const updateStructured = (i: number, patch: Partial<BaggageDraft>) =>
    update(i, { ...patch, dirty: true });
  const remove = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));
  const add = () =>
    setDrafts((d) => [
      ...d,
      {
        icon: "flight" as const,
        textHe: "",
        textEn: "",
        status: "included" as const,
        price: "",
        priceKind: "gross" as const,
        structured: true,
        dirty: true,
      },
    ]);

  async function save() {
    const rows: BaggageRow[] = [];
    for (const d of drafts) {
      if (isCategory(d.icon)) {
        if (d.structured || d.dirty) {
          if (d.status === "not_included" && !d.price.trim()) {
            toast.error(t("priceRequired"));
            return;
          }
          rows.push({
            icon: d.icon,
            text: inclusionText(d),
            inclusion: {
              status: d.status,
              ...(d.status === "not_included"
                ? { price: d.price.trim(), priceKind: d.priceKind }
                : {}),
            },
          });
        } else if (d.textHe.trim() || d.textEn.trim()) {
          // Untouched legacy row — keep its hand-written text verbatim.
          rows.push({ icon: d.icon, text: { he: d.textHe.trim(), en: d.textEn.trim() } });
        }
      } else if (d.textHe.trim() || d.textEn.trim()) {
        rows.push({ icon: d.icon, text: { he: d.textHe.trim(), en: d.textEn.trim() } });
      }
    }
    setSaving(true);
    const res = await saveSupplierBaggageAction(slug, rows);
    setSaving(false);
    if ("error" in res) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("baggageSaved"));
    onDone();
    router.refresh();
  }

  return (
    <EditorShell onSave={save} onCancel={onDone} saving={saving} addLabel={t("addBaggage")} onAdd={add} t={t}>
      {drafts.map((d, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-2">
          <div className="flex items-end gap-2">
            <Field label={t("icon")}>
              <Select
                value={d.icon}
                onValueChange={(v) => updateStructured(i, { icon: v as BaggageIcon })}
                items={Object.fromEntries(EDITOR_ICONS.map((ic) => [ic, t(ICON_KEY[ic])]))}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITOR_ICONS.map((ic) => (
                    <SelectItem key={ic} value={ic}>
                      {t(ICON_KEY[ic])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("remove")}
              onClick={() => remove(i)}
              className="shrink-0 text-muted-foreground hover:text-destructive">
              <Trash2 className="size-3.5" />
            </Button>
          </div>

          {isCategory(d.icon) ? (
            <>
              <Field label={t("status")}>
                <Select
                  value={d.status}
                  onValueChange={(v) => updateStructured(i, { status: v as InclusionStatus })}
                  items={{
                    included: t("statusIncluded"),
                    not_included: t("statusNotIncluded"),
                  }}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="included">{t("statusIncluded")}</SelectItem>
                    <SelectItem value="not_included">{t("statusNotIncluded")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {d.status === "not_included" && (
                <div className="flex gap-2">
                  <Field label={t("price")}>
                    <Input
                      value={d.price}
                      dir="ltr"
                      placeholder="130$"
                      onChange={(e) => updateStructured(i, { price: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </Field>
                  <Field label={t("priceKind")}>
                    <Select
                      value={d.priceKind}
                      onValueChange={(v) => updateStructured(i, { priceKind: v as PriceKind })}
                      items={{ gross: t("priceGross"), net: t("priceNet") }}>
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gross">{t("priceGross")}</SelectItem>
                        <SelectItem value="net">{t("priceNet")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              )}
              {!d.structured && !d.dirty && (d.textHe || d.textEn) && (
                // Legacy hand-written text: kept as-is unless the controls above
                // are touched, which regenerates it from the structured fields.
                <p className="text-[0.65rem] leading-snug text-muted-foreground" dir="auto">
                  {d.textHe || d.textEn}
                </p>
              )}
            </>
          ) : (
            <>
              <Field label={t("textHe")}>
                <Input
                  value={d.textHe}
                  dir="rtl"
                  onChange={(e) => update(i, { textHe: e.target.value })}
                  className="h-8 text-xs"
                />
              </Field>
              <Field label={t("textEn")}>
                <Input
                  value={d.textEn}
                  dir="ltr"
                  onChange={(e) => update(i, { textEn: e.target.value })}
                  className="h-8 text-xs"
                />
              </Field>
            </>
          )}
        </div>
      ))}
    </EditorShell>
  );
}
