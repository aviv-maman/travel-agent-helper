"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { BaggageIcon, CommissionKind, Localized } from "@/db/schema";
import type { BaggageRow, CommissionInput, EditableCommissionRow } from "@/lib/commissions";
import { stripPercent } from "@/lib/commissions";
import { saveSupplierBaggageAction, saveSupplierCommissionsAction } from "@/app/actions/suppliers";
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
 *
 * The row-list bodies (`CommissionRows`, `BaggageRows`) and the draft→payload
 * converters are exported controlled components so the same UI powers both the
 * inline card editors here and the create-supplier wizard.
 */

type T = ReturnType<typeof useTranslations<"commissions.editor">>;

const STANDARD_KINDS: Exclude<CommissionKind, "custom">[] = ["flights", "packages", "organized"];
// `bag` (the backpack line) is hardcoded in the card and not editable.
type EditorIcon = Exclude<BaggageIcon, "bag">;
/** Product categories with structured inclusion editing. */
const CATEGORY_ICONS: EditorIcon[] = ["flight", "package", "village", "tour"];
/** Free-text note rows ("important note" alerts) — edited as before. */
const NOTE_ICONS: EditorIcon[] = ["ok", "warn"];
const EDITOR_ICONS: EditorIcon[] = [...CATEGORY_ICONS, ...NOTE_ICONS];

const isCategory = (icon: BaggageIcon) => (CATEGORY_ICONS as BaggageIcon[]).includes(icon);

const KIND_KEY = {
  flights: "kindFlights",
  packages: "kindPackages",
  organized: "kindOrganized",
  custom: "kindCustom",
} as const;
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

/** Dashed "add row" button used at the bottom of a row list. */
function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:border-brand hover:text-brand">
      ➕ {label}
    </button>
  );
}

/** Save/Cancel footer for an inline section editor. */
function EditorFooter({
  onSave,
  onCancel,
  saving,
  t,
}: {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  t: T;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
        {t("cancel")}
      </Button>
      <Button type="button" size="sm" onClick={onSave} disabled={saving}>
        {saving ? t("saving") : t("save")}
      </Button>
    </div>
  );
}

// ── Commissions ───────────────────────────────────────────────────────────────

export type CommissionDraft = {
  kind: CommissionKind;
  /** One field per label/value — saved to both locales; the color is derived. */
  label: string;
  value: string;
};

export function toCommissionDrafts(rows: EditableCommissionRow[]): CommissionDraft[] {
  return rows.map((r) => ({
    kind: r.kind,
    label: r.label?.he ?? r.label?.en ?? "",
    // Values are stored bare — show the number without the "%" while editing.
    value: stripPercent(r.value.he ?? r.value.en ?? ""),
  }));
}

/** The first standard kind not present yet, else a custom line. */
function nextKind(drafts: CommissionDraft[]): CommissionKind {
  return STANDARD_KINDS.find((k) => !drafts.some((d) => d.kind === k)) ?? "custom";
}

export function newCommissionDraft(drafts: CommissionDraft[]): CommissionDraft {
  return { kind: nextKind(drafts), label: "", value: "" };
}

/**
 * Shape commission drafts into the server payload. One field feeds both locales
 * (the guide is Hebrew-first; values are mostly language-neutral numbers). Empty
 * values are dropped; custom lines must carry a label. Returns `{ rows }` or an
 * `{ error }` translation key.
 */
export function commissionDraftsToInputs(
  drafts: CommissionDraft[],
): { rows: CommissionInput[] } | { error: "customNeedsLabel" } {
  const rows: CommissionInput[] = drafts
    .filter((d) => stripPercent(d.value))
    .map((d) => {
      // Store bare numbers ("9.5"); the "%" is added back only on display.
      const value = stripPercent(d.value);
      const label = d.label.trim();
      return {
        kind: d.kind,
        label: d.kind === "custom" ? { he: label, en: label } : null,
        value: { he: value, en: value },
      };
    });
  if (rows.some((r) => r.kind === "custom" && !r.label?.he)) {
    return { error: "customNeedsLabel" };
  }
  return { rows };
}

/**
 * The controlled list of commission draft rows + an "add" button. When
 * `customOnly` is set (non-flights suppliers), every line is a labeled "special"
 * commission — the kind dropdown is dropped and only the label + value show.
 */
export function CommissionRows({
  drafts,
  setDrafts,
  customOnly = false,
}: {
  drafts: CommissionDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<CommissionDraft[]>>;
  /** Non-flights suppliers: only labeled "special" (custom) lines. */
  customOnly?: boolean;
}) {
  const t = useTranslations("commissions.editor");
  const update = (i: number, patch: Partial<CommissionDraft>) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));
  const add = () =>
    setDrafts((d) => [
      ...d,
      customOnly ? { kind: "custom", label: "", value: "" } : newCommissionDraft(d),
    ]);

  /** Kinds this row may use: its own, unused standard ones, and custom. */
  function kindOptions(i: number): CommissionKind[] {
    const others = drafts.filter((_, idx) => idx !== i);
    return [...STANDARD_KINDS.filter((k) => !others.some((o) => o.kind === k)), "custom"];
  }

  const removeBtn = (i: number) => (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={t("remove")}
      onClick={() => remove(i)}
      className="shrink-0 text-muted-foreground hover:text-destructive">
      <Trash2 className="size-3.5" />
    </Button>
  );

  return (
    <>
      {drafts.map((d, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-2">
          <div className="flex items-end gap-2">
            {customOnly ? (
              // Special-only: the label is the line's identity (kind is fixed).
              <Field label={t("label")}>
                <Input
                  value={d.label}
                  dir="auto"
                  onChange={(e) => update(i, { label: e.target.value })}
                  className="h-8 text-xs"
                />
              </Field>
            ) : (
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
            )}
            {removeBtn(i)}
          </div>
          {!customOnly && d.kind === "custom" && (
            <Field label={t("label")}>
              <Input
                value={d.label}
                dir="auto"
                onChange={(e) => update(i, { label: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>
          )}
          <Field label={t("value")}>
            <Input
              value={d.value}
              dir="auto"
              placeholder="9.5"
              onChange={(e) => update(i, { value: e.target.value })}
              className="h-8 text-xs"
            />
          </Field>
        </div>
      ))}
      <AddRowButton label={t("addCommission")} onClick={add} />
    </>
  );
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

  async function save() {
    const res = commissionDraftsToInputs(drafts);
    if ("error" in res) {
      toast.error(t(res.error));
      return;
    }
    setSaving(true);
    const result = await saveSupplierCommissionsAction(slug, res.rows);
    setSaving(false);
    if ("error" in result) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("commissionsSaved"));
    onDone();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 p-2.5">
      <CommissionRows drafts={drafts} setDrafts={setDrafts} />
      <EditorFooter onSave={save} onCancel={onDone} saving={saving} t={t} />
    </div>
  );
}

// ── Baggage ───────────────────────────────────────────────────────────────────

type InclusionStatus = "included" | "not_included";
type PriceKind = "gross" | "net";

export type BaggageDraft = {
  icon: BaggageIcon;
  /** Free text — note rows (ok/warn), and the legacy passthrough for category rows. */
  textHe: string;
  textEn: string;
  /** Structured fields for category rows. */
  status: InclusionStatus;
  suitcasePrice: string;
  trolleyPrice: string;
  priceKind: PriceKind;
  /** Row was already structured (has `inclusion`) when loaded. */
  structured: boolean;
  /** Structured fields touched — the text will be regenerated on save. */
  dirty: boolean;
};

/** Category prefixes the generated text opens with (the card strips them). */
const CATEGORY_LABEL: Record<string, { he: string; en: string }> = {
  flight: { he: "טיסות בלבד", en: "Flights only" },
  package: { he: "חבילות נופש", en: "Vacation packages" },
  village: { he: "כפרי נופש", en: "Holiday villages" },
  tour: { he: "טיולים מאורגנים", en: "Organized tours" },
};

/**
 * The display text (both locales) a structured category row generates —
 * matching the hand-written rows' format exactly, e.g.
 * "טיסות בלבד: מזוודה וטרולי לא כלולים\nמזוודה הלוך ושוב: **130$ ברוטו**\nטרולי הלוך ושוב: **60$ ברוטו**".
 */
function inclusionText(d: BaggageDraft): Localized {
  const cat = CATEGORY_LABEL[d.icon] ?? { he: "", en: "" };
  if (d.status === "included") {
    return {
      he: `${cat.he}: מזוודה וטרולי כלולים`,
      en: `${cat.en}: suitcase & trolley included`,
    };
  }
  const kindHe = d.priceKind === "gross" ? "ברוטו" : "נטו";
  const kindEn = d.priceKind === "gross" ? "gross" : "net";
  const suitcase = d.suitcasePrice.trim();
  const trolley = d.trolleyPrice.trim();
  return {
    he: `${cat.he}: מזוודה וטרולי לא כלולים\nמזוודה הלוך ושוב: **${suitcase} ${kindHe}**\nטרולי הלוך ושוב: **${trolley} ${kindHe}**`,
    en: `${cat.en}: suitcase & trolley not included\nSuitcase round trip: **${suitcase} ${kindEn}**\nTrolley round trip: **${trolley} ${kindEn}**`,
  };
}

/**
 * Legacy category rows (seeded from the old HTML) keep their prices only inside
 * the free text, with no structured `inclusion`. Parse them back — the inverse
 * of `inclusionText` — so the editor's price fields open pre-filled with the
 * real values instead of empty placeholders. Falls back to the English line when
 * the Hebrew one is missing.
 */
function parseLegacyPrices(
  textHe: string,
  textEn: string,
): {
  suitcasePrice: string;
  trolleyPrice: string;
  priceKind: PriceKind;
} {
  const suit =
    textHe.match(/מזוודה הלוך ושוב:\s*\*\*(.+?)\s+(ברוטו|נטו)\*\*/) ??
    textEn.match(/Suitcase round trip:\s*\*\*(.+?)\s+(gross|net)\*\*/i);
  const trol =
    textHe.match(/טרולי הלוך ושוב:\s*\*\*(.+?)\s+(ברוטו|נטו)\*\*/) ??
    textEn.match(/Trolley round trip:\s*\*\*(.+?)\s+(gross|net)\*\*/i);
  const kind = (suit ?? trol)?.[2]?.toLowerCase();
  return {
    suitcasePrice: suit?.[1]?.trim() ?? "",
    trolleyPrice: trol?.[1]?.trim() ?? "",
    priceKind: kind === "נטו" || kind === "net" ? "net" : "gross",
  };
}

/** Build baggage drafts from stored rows (skips the hardcoded backpack line). */
export function toBaggageDrafts(initial: BaggageRow[]): BaggageDraft[] {
  return (
    initial
      // The backpack line is hardcoded in the card now — legacy `bag` rows are
      // not editable and get dropped on the next save.
      .filter((r) => r.icon !== "bag")
      .map((r) => {
        // Legacy free-text rows carry their prices only in the text — recover
        // them so the price fields open pre-filled rather than empty.
        const legacy = r.inclusion ? null : parseLegacyPrices(r.text.he ?? "", r.text.en ?? "");
        return {
          icon: r.icon,
          textHe: r.text.he ?? "",
          textEn: r.text.en ?? "",
          // Legacy free-text rows: sniff a sensible default for the controls.
          status:
            r.inclusion?.status ??
            ((r.text.he ?? "").includes("לא כלול") ? "not_included" : "included"),
          // `price` covers rows saved before the suitcase/trolley split.
          suitcasePrice:
            r.inclusion?.suitcasePrice ?? r.inclusion?.price ?? legacy?.suitcasePrice ?? "",
          trolleyPrice: r.inclusion?.trolleyPrice ?? legacy?.trolleyPrice ?? "",
          priceKind: r.inclusion?.priceKind ?? legacy?.priceKind ?? "gross",
          structured: Boolean(r.inclusion),
          dirty: false,
        };
      })
  );
}

export function newBaggageDraft(): BaggageDraft {
  return {
    icon: "flight",
    textHe: "",
    textEn: "",
    status: "included",
    suitcasePrice: "",
    trolleyPrice: "",
    priceKind: "gross",
    structured: true,
    dirty: true,
  };
}

/**
 * Shape baggage drafts into the server payload. Category rows regenerate their
 * text from the structured fields (untouched legacy rows keep their hand-written
 * text); note rows carry free text. Returns `{ rows }` or an `{ error }` key.
 */
export function baggageDraftsToRows(
  drafts: BaggageDraft[],
): { rows: BaggageRow[] } | { error: "priceRequired" } {
  const rows: BaggageRow[] = [];
  for (const d of drafts) {
    if (isCategory(d.icon)) {
      if (d.structured || d.dirty) {
        if (d.status === "not_included" && (!d.suitcasePrice.trim() || !d.trolleyPrice.trim())) {
          return { error: "priceRequired" };
        }
        rows.push({
          icon: d.icon,
          text: inclusionText(d),
          inclusion: {
            status: d.status,
            ...(d.status === "not_included"
              ? {
                  suitcasePrice: d.suitcasePrice.trim(),
                  trolleyPrice: d.trolleyPrice.trim(),
                  priceKind: d.priceKind,
                }
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
  return { rows };
}

/** The controlled list of baggage draft rows + an "add" button. */
export function BaggageRows({
  drafts,
  setDrafts,
}: {
  drafts: BaggageDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<BaggageDraft[]>>;
}) {
  const t = useTranslations("commissions.editor");
  const update = (i: number, patch: Partial<BaggageDraft>) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  /** Structured-field change: also marks the row for text regeneration. */
  const updateStructured = (i: number, patch: Partial<BaggageDraft>) =>
    update(i, { ...patch, dirty: true });
  const remove = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));
  const add = () => setDrafts((d) => [...d, newBaggageDraft()]);

  return (
    <>
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
                  <Field label={t("priceSuitcase")}>
                    <Input
                      value={d.suitcasePrice}
                      dir="ltr"
                      placeholder="130$"
                      onChange={(e) => updateStructured(i, { suitcasePrice: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </Field>
                  <Field label={t("priceTrolley")}>
                    <Input
                      value={d.trolleyPrice}
                      dir="ltr"
                      placeholder="60$"
                      onChange={(e) => updateStructured(i, { trolleyPrice: e.target.value })}
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
      <AddRowButton label={t("addBaggage")} onClick={add} />
    </>
  );
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
  const [drafts, setDrafts] = useState<BaggageDraft[]>(() => toBaggageDrafts(initial));

  async function save() {
    const res = baggageDraftsToRows(drafts);
    if ("error" in res) {
      toast.error(t(res.error));
      return;
    }
    setSaving(true);
    const result = await saveSupplierBaggageAction(slug, res.rows);
    setSaving(false);
    if ("error" in result) {
      toast.error(t("saveFailed"));
      return;
    }
    toast.success(t("baggageSaved"));
    onDone();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 p-2.5">
      <BaggageRows drafts={drafts} setDrafts={setDrafts} />
      <EditorFooter onSave={save} onCancel={onDone} saving={saving} t={t} />
    </div>
  );
}
