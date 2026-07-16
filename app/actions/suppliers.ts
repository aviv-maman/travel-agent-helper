"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  supplierCommissions,
  suppliers,
  type BaggageIcon,
  type BaggageRow,
  type CommissionKind,
  type Localized,
} from "@/db/schema";
import { can } from "@/lib/auth";
import { deriveCommissionLevel, stripPercent, type CommissionInput } from "@/lib/commissions";

/**
 * Editor+ inline updates of a supplier's commission lines and baggage rows
 * (the suppliers-page pencil/+ buttons). The UI only shows the controls to
 * permitted users, but these re-checks are the real security boundary.
 *
 * The app is the source of truth for these two: the seed is bootstrap-only
 * for commission lines and baggage (like contacts), so `bun run seed` never
 * overwrites in-app edits. The lib/commissions.ts arrays remain the no-DB
 * fallback and the first-boot seed.
 *
 * No `revalidatePath`: the card calls `router.refresh()` on success (the
 * dashboard/contacts convention).
 */

export type SaveResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };

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

export async function saveSupplierCommissionsAction(
  slug: string,
  rows: CommissionInput[],
): Promise<SaveResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  if (!Array.isArray(rows) || rows.length > 12) return { error: "invalid" };

  type CleanRow = Omit<typeof supplierCommissions.$inferInsert, "supplierId">;
  const clean: CleanRow[] = [];
  const seenStandard = new Set<CommissionKind>();
  let customOrder = 0;
  for (const r of rows) {
    if (!KINDS.includes(r.kind)) return { error: "invalid" };
    const cleaned = cleanLocalized(r.value, 80);
    if (!cleaned) return { error: "invalid" };
    // Percentages are stored as bare numbers; the "%" is presentation only.
    const value: Localized = {
      ...(cleaned.he ? { he: stripPercent(cleaned.he) } : {}),
      ...(cleaned.en ? { en: stripPercent(cleaned.en) } : {}),
    };
    if (!value.he && !value.en) return { error: "invalid" };
    // The chip color is derived from the value, never taken from the client.
    const level = deriveCommissionLevel(value.he ?? value.en ?? "");
    if (r.kind === "custom") {
      const label = cleanLocalized(r.label, 120);
      if (!label) return { error: "invalid" };
      if (customOrder >= 3) return { error: "invalid" }; // the card renders up to 3
      clean.push({ kind: r.kind, label, value, level, sortOrder: customOrder++ });
    } else {
      if (seenStandard.has(r.kind)) return { error: "invalid" };
      seenStandard.add(r.kind);
      clean.push({ kind: r.kind, label: null, value, level, sortOrder: 0 });
    }
  }

  try {
    const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.slug, slug) });
    if (!supplier) return { error: "invalid" };
    await db.delete(supplierCommissions).where(eq(supplierCommissions.supplierId, supplier.id));
    if (clean.length) {
      await db
        .insert(supplierCommissions)
        .values(clean.map((c) => ({ ...c, supplierId: supplier.id })));
    }
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

export async function saveSupplierBaggageAction(
  slug: string,
  rows: BaggageRow[],
): Promise<SaveResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  if (!Array.isArray(rows) || rows.length > 20) return { error: "invalid" };

  const clean: BaggageRow[] = [];
  for (const r of rows) {
    const category = CATEGORY_ICONS.includes(r.icon);
    if (!category && !NOTE_ICONS.includes(r.icon)) return { error: "invalid" };
    const text = cleanLocalized(r.text, 300);
    if (!text) return { error: "invalid" };
    if (!r.inclusion) {
      clean.push({ icon: r.icon, text });
      continue;
    }
    if (!category) return { error: "invalid" };
    if (r.inclusion.status === "included") {
      clean.push({ icon: r.icon, text, inclusion: { status: "included" } });
    } else if (r.inclusion.status === "not_included") {
      const suitcasePrice = (r.inclusion.suitcasePrice ?? "").trim().slice(0, 20);
      const trolleyPrice = (r.inclusion.trolleyPrice ?? "").trim().slice(0, 20);
      const priceKind = r.inclusion.priceKind;
      if (!suitcasePrice || !trolleyPrice || (priceKind !== "gross" && priceKind !== "net")) {
        return { error: "invalid" };
      }
      clean.push({
        icon: r.icon,
        text,
        inclusion: { status: "not_included", suitcasePrice, trolleyPrice, priceKind },
      });
    } else {
      return { error: "invalid" };
    }
  }

  try {
    const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.slug, slug) });
    if (!supplier) return { error: "invalid" };
    await db.update(suppliers).set({ baggage: clean }).where(eq(suppliers.id, supplier.id));
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}
