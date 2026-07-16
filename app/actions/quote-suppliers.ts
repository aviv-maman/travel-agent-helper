"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { quoteSuppliers } from "@/db/schema";
import { can } from "@/lib/auth";

/**
 * Editor+ CRUD for the AI quote assistant's supplier table (the settings-page
 * editor). Percentages arrive and are stored bare ("7.5"); baggage cells keep
 * the sheet grammar ("כלול" / "130$" / empty = unknown). The backend's quote
 * skill reads this table (with the legacy Google Sheet as fallback), so bad
 * numbers here become bad client quotes — validation is strict.
 *
 * No `revalidatePath`: the table calls `router.refresh()` on success.
 */

export type QuoteSupplierInput = {
  nameEn: string;
  nameHe: string;
  baggageSuitcase: string;
  baggageTrolley: string;
  netFlightNoStar: string;
  netFlightStar: string;
  netPackageNoStar: string;
  netPackageStar: string;
  notes: string;
};

export type SaveResult = { ok: true; id: number } | { error: "forbidden" | "invalid" | "offline" };
export type DeleteResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };

const PCT_KEYS = [
  "netFlightNoStar",
  "netFlightStar",
  "netPackageNoStar",
  "netPackageStar",
] as const;

/** Bare percent 0–100 with up to 2 decimals, or null when blank. Throws on junk. */
function cleanPct(raw: string): string | null {
  const s = (raw ?? "").trim().replace(/%$/, "").trim();
  if (!s) return null;
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(s) || Number(s) > 100) throw new Error("bad pct");
  return String(Number(s)); // normalize "7.50" → "7.5"
}

export async function saveQuoteSupplierAction(
  id: number | null,
  input: QuoteSupplierInput,
): Promise<SaveResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };

  const nameEn = (input.nameEn ?? "").trim().slice(0, 64);
  if (!nameEn) return { error: "invalid" };
  let pct: Record<(typeof PCT_KEYS)[number], string | null>;
  try {
    pct = Object.fromEntries(PCT_KEYS.map((k) => [k, cleanPct(input[k])])) as typeof pct;
  } catch {
    return { error: "invalid" };
  }
  const values = {
    nameEn,
    nameHe: (input.nameHe ?? "").trim().slice(0, 64),
    baggageSuitcase: (input.baggageSuitcase ?? "").trim().slice(0, 32) || null,
    baggageTrolley: (input.baggageTrolley ?? "").trim().slice(0, 32) || null,
    ...pct,
    notes: (input.notes ?? "").trim().slice(0, 500),
  };

  try {
    if (id === null) {
      const [row] = await db
        .insert(quoteSuppliers)
        .values({
          ...values,
          sortOrder: sql`coalesce((select max(sort_order) + 1 from quote_suppliers), 0)`,
        })
        .returning({ id: quoteSuppliers.id });
      return { ok: true, id: row.id };
    }
    const updated = await db
      .update(quoteSuppliers)
      .set(values)
      .where(eq(quoteSuppliers.id, id))
      .returning({ id: quoteSuppliers.id });
    if (updated.length === 0) return { error: "invalid" };
    return { ok: true, id };
  } catch {
    return { error: "offline" };
  }
}

export async function deleteQuoteSupplierAction(id: number): Promise<DeleteResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  try {
    const deleted = await db
      .delete(quoteSuppliers)
      .where(eq(quoteSuppliers.id, id))
      .returning({ id: quoteSuppliers.id });
    if (deleted.length === 0) return { error: "invalid" };
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}
