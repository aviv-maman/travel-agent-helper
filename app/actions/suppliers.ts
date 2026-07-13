"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  supplierCommissions,
  suppliers,
  type BaggageIcon,
  type BaggageRow,
  type CommissionKind,
  type CommLevel,
  type Localized,
} from "@/db/schema";
import { can } from "@/lib/auth";
import type { EditableCommissionRow } from "@/lib/commissions";

/**
 * Editor+ inline updates of a supplier's commission lines and baggage rows
 * (the suppliers-page pencil/+ buttons). The UI only shows the controls to
 * permitted users, but these re-checks are the real security boundary.
 *
 * Like the hotels booking score: `bun run seed` resets suppliers to the
 * curated arrays in lib/commissions.ts, so lasting changes should also be
 * folded back into the seed data.
 *
 * No `revalidatePath`: the card calls `router.refresh()` on success (the
 * dashboard/contacts convention).
 */

export type SaveResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };

const KINDS: readonly CommissionKind[] = ["flights", "packages", "organized", "custom"];
const LEVELS: readonly CommLevel[] = ["high", "mid", "low", "range", "net"];
const ICONS: readonly BaggageIcon[] = ["bag", "ok", "warn", "flight", "package", "tour", "village"];

/** Trim a Localized value's fields and drop empty locales; null when fully empty. */
function cleanLocalized(v: Localized | null | undefined, max: number): Localized | null {
  const he = (v?.he ?? "").trim().slice(0, max);
  const en = (v?.en ?? "").trim().slice(0, max);
  if (!he && !en) return null;
  return { ...(he ? { he } : {}), ...(en ? { en } : {}) };
}

export async function saveSupplierCommissionsAction(
  slug: string,
  rows: EditableCommissionRow[],
): Promise<SaveResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  if (!Array.isArray(rows) || rows.length > 12) return { error: "invalid" };

  type CleanRow = Omit<typeof supplierCommissions.$inferInsert, "supplierId">;
  const clean: CleanRow[] = [];
  const seenStandard = new Set<CommissionKind>();
  let customOrder = 0;
  for (const r of rows) {
    if (!KINDS.includes(r.kind) || !LEVELS.includes(r.level)) return { error: "invalid" };
    const value = cleanLocalized(r.value, 80);
    if (!value) return { error: "invalid" };
    if (r.kind === "custom") {
      const label = cleanLocalized(r.label, 120);
      if (!label) return { error: "invalid" };
      if (customOrder >= 3) return { error: "invalid" }; // the card renders up to 3
      clean.push({ kind: r.kind, label, value, level: r.level, sortOrder: customOrder++ });
    } else {
      if (seenStandard.has(r.kind)) return { error: "invalid" };
      seenStandard.add(r.kind);
      clean.push({ kind: r.kind, label: null, value, level: r.level, sortOrder: 0 });
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
    if (!ICONS.includes(r.icon)) return { error: "invalid" };
    const text = cleanLocalized(r.text, 300);
    if (!text) return { error: "invalid" };
    clean.push({ icon: r.icon, text });
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
