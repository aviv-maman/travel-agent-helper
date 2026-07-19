/**
 * Pure validators for supplier commissions, baggage, and contacts — shared by
 * the inline save actions (`app/actions/suppliers.ts`, `app/actions/contacts.ts`)
 * and the atomic `createSupplierAction`. They live here (not in a `"use server"`
 * file) because those only allow async exports; these must stay callable sync.
 *
 * Each returns cleaned rows or `null` for invalid input. Percentages are stored
 * bare (the "%" is presentation), chip colors are derived from the value (never
 * trusted from the client), and a category baggage row without an `inclusion`
 * is only allowed for legacy free-text rows.
 */

import type { supplierCommissions } from "@/db/schema";
import type { BaggageIcon, BaggageRow, CommissionKind, Localized } from "@/db/schema";
import { deriveCommissionLevel, stripPercent, type CommissionInput } from "@/lib/commissions";
import { CONTACT_TYPES, type ContactGroup } from "@/lib/contacts";

const KINDS: readonly CommissionKind[] = ["flights", "packages", "organized", "custom"];
/** Category rows carry structured `inclusion`; note rows are free text. `bag`
 * is not writable — the backpack line is hardcoded in the card. */
const CATEGORY_ICONS: readonly BaggageIcon[] = ["flight", "package", "village", "tour"];
const NOTE_ICONS: readonly BaggageIcon[] = ["ok", "warn"];

/** Trim a Localized value's fields and drop empty locales; null when fully empty. */
function cleanLocalized(v: Localized | null | undefined, max: number): Localized | null {
  const he = (v?.he ?? "").trim().slice(0, max);
  const en = (v?.en ?? "").trim().slice(0, max);
  if (!he && !en) return null;
  return { ...(he ? { he } : {}), ...(en ? { en } : {}) };
}

export type CleanCommissionRow = Omit<typeof supplierCommissions.$inferInsert, "supplierId">;

/** Validate commission input rows → insert-ready rows (sans supplierId). */
export function validateCommissionRows(rows: CommissionInput[]): CleanCommissionRow[] | null {
  if (!Array.isArray(rows) || rows.length > 12) return null;
  const clean: CleanCommissionRow[] = [];
  const seenStandard = new Set<CommissionKind>();
  let customOrder = 0;
  for (const r of rows) {
    if (!KINDS.includes(r.kind)) return null;
    const cleaned = cleanLocalized(r.value, 80);
    if (!cleaned) return null;
    // Percentages are stored as bare numbers; the "%" is presentation only.
    const value: Localized = {
      ...(cleaned.he ? { he: stripPercent(cleaned.he) } : {}),
      ...(cleaned.en ? { en: stripPercent(cleaned.en) } : {}),
    };
    if (!value.he && !value.en) return null;
    // The chip color is derived from the value, never taken from the client.
    const level = deriveCommissionLevel(value.he ?? value.en ?? "");
    if (r.kind === "custom") {
      const label = cleanLocalized(r.label, 120);
      if (!label) return null;
      if (customOrder >= 3) return null; // the card renders up to 3
      clean.push({ kind: r.kind, label, value, level, sortOrder: customOrder++ });
    } else {
      if (seenStandard.has(r.kind)) return null;
      seenStandard.add(r.kind);
      clean.push({ kind: r.kind, label: null, value, level, sortOrder: 0 });
    }
  }
  return clean;
}

/** Validate baggage rows (regenerated-text rows already computed by the editor). */
export function validateBaggageRows(rows: BaggageRow[]): BaggageRow[] | null {
  if (!Array.isArray(rows) || rows.length > 20) return null;
  const clean: BaggageRow[] = [];
  for (const r of rows) {
    const category = CATEGORY_ICONS.includes(r.icon);
    if (!category && !NOTE_ICONS.includes(r.icon)) return null;
    const text = cleanLocalized(r.text, 300);
    if (!text) return null;
    if (!r.inclusion) {
      clean.push({ icon: r.icon, text });
      continue;
    }
    if (!category) return null;
    if (r.inclusion.status === "included") {
      clean.push({ icon: r.icon, text, inclusion: { status: "included" } });
    } else if (r.inclusion.status === "not_included") {
      const suitcasePrice = (r.inclusion.suitcasePrice ?? "").trim().slice(0, 20);
      const trolleyPrice = (r.inclusion.trolleyPrice ?? "").trim().slice(0, 20);
      const priceKind = r.inclusion.priceKind;
      if (!suitcasePrice || !trolleyPrice || (priceKind !== "gross" && priceKind !== "net")) {
        return null;
      }
      clean.push({
        icon: r.icon,
        text,
        inclusion: { status: "not_included", suitcasePrice, trolleyPrice, priceKind },
      });
    } else {
      return null;
    }
  }
  return clean;
}

/** Validate contact groups → the subset worth persisting. Null when malformed. */
export function cleanContactGroups(groups: ContactGroup[]): ContactGroup[] | null {
  if (!Array.isArray(groups)) return null;
  const clean: ContactGroup[] = [];
  for (const g of groups) {
    if (!CONTACT_TYPES.includes(g.type)) return null;
    const label = (g.label ?? "").trim().slice(0, 120);
    const phone = (g.phone ?? "").trim().slice(0, 32);
    const email = (g.email ?? "").trim().slice(0, 160);
    if (!label || (!phone && !email)) continue;
    clean.push({ active: Boolean(g.active), label, type: g.type, phone, email });
  }
  if (clean.length > 100) return null;
  return clean;
}
