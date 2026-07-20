"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, supplierCancellations, type CancelMarkup, type Fee, type FeeLevel, type Localized } from "@/db/schema";
import { can } from "@/lib/auth";
import { sectionsToBlocks, type EditSection } from "@/lib/cancellations-edit";

/**
 * Editor-only save for a supplier's cancellation card. The client sends the
 * markup rule + the edited sections (net fee tables with category context); we
 * rebuild the stored blocks AND regenerate each section's client-copy script
 * from the net rows + markup. `editedAt` is stamped so the seed then preserves
 * it. The UI only shows the controls to permitted users — this re-check is the
 * security boundary. No `revalidatePath`: the page calls `router.refresh()`.
 */

export type CancelSectionInput = EditSection;
export type SaveResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };

const LEVELS: FeeLevel[] = ["low", "net", "gross", "full"];
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

export async function saveCancellationAction(
  slug: string,
  markup: CancelMarkup,
  sections: CancelSectionInput[],
): Promise<SaveResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };

  const m = validMarkup(markup);
  if (!m) return { error: "invalid" };
  if (!Array.isArray(sections) || sections.length === 0 || sections.length > 40) {
    return { error: "invalid" };
  }
  for (const s of sections) {
    if (!hasHe(s.caption)) return { error: "invalid" };
    if (!Array.isArray(s.rows) || s.rows.length === 0 || s.rows.length > 20) {
      return { error: "invalid" };
    }
    for (const r of s.rows) {
      if (!hasHe(r.timeframe) || !LEVELS.includes(r.level) || !validFee(r.fee)) {
        return { error: "invalid" };
      }
    }
  }

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
