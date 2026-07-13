"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { BaggageIcon, CommissionKind, CommLevel } from "@/db/schema";
import type { BaggageRow, EditableCommissionRow } from "@/lib/commissions";
import {
  saveSupplierBaggageAction,
  saveSupplierCommissionsAction,
} from "@/app/actions/suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Inline (no modal) editors for a supplier card's two sections. The pencil
 * swaps the section body for editable rows; the plus does the same and appends
 * a fresh row. Editing needs the database (the no-DB fallback is read-only)
 * and `content:edit` — the server actions re-check.
 */

type T = ReturnType<typeof useTranslations<"commissions.editor">>;

const LEVELS: CommLevel[] = ["high", "mid", "low", "range", "net"];
const STANDARD_KINDS: Exclude<CommissionKind, "custom">[] = [
  "flights",
  "packages",
  "organized",
];
const ICONS: BaggageIcon[] = ["flight", "package", "village", "tour", "bag", "ok", "warn"];

const KIND_KEY = { flights: "kindFlights", packages: "kindPackages", organized: "kindOrganized", custom: "kindCustom" } as const;
const LEVEL_KEY = { high: "levelHigh", mid: "levelMid", low: "levelLow", range: "levelRange", net: "levelNet" } as const;
const ICON_KEY = {
  flight: "iconFlight",
  package: "iconPackage",
  village: "iconVillage",
  tour: "iconTour",
  bag: "iconBag",
  ok: "iconOk",
  warn: "iconWarn",
} as const;

/** The pencil + plus pair shown at the end of a section header for editors. */
export function SectionEditButtons({
  onEdit,
  onAdd,
  disabled,
}: {
  onEdit: () => void;
  onAdd: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("commissions.editor");
  return (
    <span className="ms-auto flex items-center gap-1">
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
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("add")}
        disabled={disabled}
        onClick={onAdd}
        className="text-muted-foreground hover:text-foreground">
        <Plus className="size-4" />
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

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring dark:bg-input/30";

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

export function newCommissionDraft(drafts: CommissionDraft[]): CommissionDraft {
  return { kind: nextKind(drafts), labelHe: "", labelEn: "", valueHe: "", valueEn: "", level: "mid" };
}

export function CommissionsEditor({
  slug,
  initial,
  startWithNewRow,
  onDone,
}: {
  slug: string;
  initial: EditableCommissionRow[];
  /** True when opened via the plus button — starts with a fresh row appended. */
  startWithNewRow: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("commissions.editor");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<CommissionDraft[]>(() => {
    const base = toCommissionDrafts(initial);
    return startWithNewRow ? [...base, newCommissionDraft(base)] : base;
  });

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
              <select
                value={d.kind}
                onChange={(e) => update(i, { kind: e.target.value as CommissionKind })}
                className={selectClass}>
                {kindOptions(i).map((k) => (
                  <option key={k} value={k}>
                    {t(KIND_KEY[k])}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("level")}>
              <select
                value={d.level}
                onChange={(e) => update(i, { level: e.target.value as CommLevel })}
                className={selectClass}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {t(LEVEL_KEY[l])}
                  </option>
                ))}
              </select>
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

type BaggageDraft = { icon: BaggageIcon; textHe: string; textEn: string };

export function BaggageEditor({
  slug,
  initial,
  startWithNewRow,
  onDone,
}: {
  slug: string;
  initial: BaggageRow[];
  startWithNewRow: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("commissions.editor");
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<BaggageDraft[]>(() => {
    const base = initial.map((r) => ({
      icon: r.icon,
      textHe: r.text.he ?? "",
      textEn: r.text.en ?? "",
    }));
    return startWithNewRow ? [...base, { icon: "flight" as const, textHe: "", textEn: "" }] : base;
  });

  const update = (i: number, patch: Partial<BaggageDraft>) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));
  const add = () => setDrafts((d) => [...d, { icon: "flight" as const, textHe: "", textEn: "" }]);

  async function save() {
    const rows: BaggageRow[] = drafts
      .filter((d) => d.textHe.trim() || d.textEn.trim())
      .map((d) => ({ icon: d.icon, text: { he: d.textHe.trim(), en: d.textEn.trim() } }));
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
              <select
                value={d.icon}
                onChange={(e) => update(i, { icon: e.target.value as BaggageIcon })}
                className={selectClass}>
                {ICONS.map((ic) => (
                  <option key={ic} value={ic}>
                    {t(ICON_KEY[ic])}
                  </option>
                ))}
              </select>
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
        </div>
      ))}
    </EditorShell>
  );
}
