"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  suppliers,
  supplierCancellations,
  type CancelMarkup,
  type CancelProduct,
  type Fee,
  type FeeLevel,
  type Localized,
} from "@/db/schema";
import { can } from "@/lib/auth";
import { sectionsToBlocks, type EditSection } from "@/lib/cancellations-edit";

/**
 * Editor-only mutations for cancellation cards. The client sends the markup rule
 * + edited sections (net fee tables with category context); we rebuild the
 * stored blocks AND regenerate each section's client-copy script from the net
 * rows + markup. `editedAt` is stamped so the seed then preserves it. The UI
 * only shows the controls to permitted users — these re-checks are the security
 * boundary. No `revalidatePath`: the page calls `router.refresh()`.
 */

export type CancelSectionInput = EditSection;
export type SaveResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };
export type CreateResult =
  | { ok: true; slug: string }
  | { error: "forbidden" | "invalid" | "exists" | "offline" };

const LEVELS: FeeLevel[] = ["low", "net", "gross", "full"];
const PRODUCT_KINDS = ["flight", "package", "organized"];
const clampNum = (n: unknown, max: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 0), max) : null;

function validMarkup(m: CancelMarkup): CancelMarkup | null {
  const points = clampNum(m?.points, 100);
  const dollars = clampNum(m?.dollars, 100000);
  const euros = clampNum(m?.euros, 100000);
  if (points == null || dollars == null || euros == null) return null;
  return { points, dollars, euros };
}

function validFee(fee: Fee): fee is Fee {
  if (!fee || typeof fee !== "object") return false;
  if (fee.kind === "percent") return Number.isFinite(fee.value) && fee.value >= 0 && fee.value <= 100;
  if (fee.kind === "amount") {
    return (
      (fee.currency === "usd" || fee.currency === "eur") &&
      Number.isFinite(fee.value) &&
      fee.value >= 0 &&
      fee.value <= 1000000
    );
  }
  return fee.kind === "text" && typeof fee.label?.he === "string";
}

const hasHe = (v: Localized | null | undefined) => Boolean(v && typeof v.he === "string" && v.he.trim());

function sectionsValid(sections: EditSection[]): boolean {
  if (!Array.isArray(sections) || sections.length === 0 || sections.length > 40) return false;
  for (const s of sections) {
    if (!hasHe(s.caption)) return false;
    if (!Array.isArray(s.rows) || s.rows.length === 0 || s.rows.length > 20) return false;
    for (const r of s.rows) {
      if (!hasHe(r.timeframe) || !LEVELS.includes(r.level) || !validFee(r.fee)) return false;
    }
  }
  return true;
}

export async function saveCancellationAction(
  slug: string,
  markup: CancelMarkup,
  sections: CancelSectionInput[],
): Promise<SaveResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  const m = validMarkup(markup);
  if (!m || !sectionsValid(sections)) return { error: "invalid" };

  try {
    const supplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.slug, slug),
      columns: { id: true },
    });
    if (!supplier) return { error: "invalid" };

    const blocks = sectionsToBlocks(sections, m);
    const res = await db
      .update(supplierCancellations)
      .set({ blocks, markup: m, editedAt: new Date() })
      .where(eq(supplierCancellations.supplierId, supplier.id))
      .returning({ id: supplierCancellations.id });
    if (res.length === 0) return { error: "invalid" };
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

/**
 * Create a brand-new cancellation supplier: a `suppliers` row (name + code +
 * logo, category "flights") plus its `supplierCancellations` card, in the
 * near-atomic pattern (compensating delete if the second insert fails).
 */
export async function createCancellationSupplierAction(
  supplier: { name: string; code: string; logoUrl: string | null; products: CancelProduct[] },
  markup: CancelMarkup,
  sections: CancelSectionInput[],
): Promise<CreateResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };

  const m = validMarkup(markup);
  const name = (supplier?.name ?? "").trim().slice(0, 80);
  const code = (supplier?.code ?? "").trim().slice(0, 24);
  const products = Array.isArray(supplier?.products) ? supplier.products : [];
  if (!m || !name || !code || products.length === 0 || !sectionsValid(sections)) {
    return { error: "invalid" };
  }
  for (const p of products) {
    if (!p || !PRODUCT_KINDS.includes(p.kind) || typeof p.label?.he !== "string") {
      return { error: "invalid" };
    }
  }
  const slug =
    code
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `sup-${Date.now()}`;

  try {
    const existing = await db.query.suppliers.findFirst({
      where: eq(suppliers.slug, slug),
      columns: { id: true },
    });
    if (existing) return { error: "exists" };

    const [row] = await db
      .insert(suppliers)
      .values({
        slug,
        name: { he: name, en: name },
        code,
        category: "flights",
        logo: supplier.logoUrl ?? null,
      })
      .returning({ id: suppliers.id });

    try {
      const [{ n }] = await db
        .select({ n: sql<number>`coalesce(max(${supplierCancellations.sortOrder}), 0)` })
        .from(supplierCancellations);
      await db.insert(supplierCancellations).values({
        supplierId: row.id,
        products: products.map((p) => ({ kind: p.kind, label: p.label })),
        blocks: sectionsToBlocks(sections, m),
        markup: m,
        editedAt: new Date(),
        sortOrder: Number(n) + 1,
      });
    } catch (e) {
      // Compensate: the supplier row must not linger without its card.
      await db.delete(suppliers).where(eq(suppliers.id, row.id));
      throw e;
    }
    return { ok: true, slug };
  } catch {
    return { error: "offline" };
  }
}
