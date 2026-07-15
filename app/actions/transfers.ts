"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transferCities, type Localized, type PillVariant, type TransferPill } from "@/db/schema";
import { can } from "@/lib/auth";

/**
 * Editor+ update of a transfer city's inclusion pills (the transfers-page
 * pencil). The UI only shows the control to permitted users, but this
 * re-check is the real security boundary.
 *
 * Transfer cities are app-managed after first boot (the seed is
 * bootstrap-only, like contacts), so `bun run seed` never overwrites edits.
 *
 * No `revalidatePath`: the dialog calls `router.refresh()` on success.
 */

export type SaveResult = { ok: true } | { error: "forbidden" | "invalid" };

const VARIANTS: readonly PillVariant[] = ["yes", "no", "warn"];

function cleanLocalized(v: Localized | null | undefined, max: number): Localized | null {
  const he = (v?.he ?? "").trim().slice(0, max);
  const en = (v?.en ?? "").trim().slice(0, max);
  if (!he && !en) return null;
  return { ...(he ? { he } : {}), ...(en ? { en } : {}) };
}

export async function saveTransferCityPillsAction(
  cityId: number,
  pills: TransferPill[],
): Promise<SaveResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  if (!Number.isInteger(cityId) || !Array.isArray(pills)) return { error: "invalid" };
  if (pills.length < 1 || pills.length > 16) return { error: "invalid" };

  const clean: TransferPill[] = [];
  for (const p of pills) {
    if (!VARIANTS.includes(p.variant)) return { error: "invalid" };
    const label = cleanLocalized(p.label, 64);
    if (!label) return { error: "invalid" };
    const tooltip = cleanLocalized(p.tooltip ?? null, 160);
    clean.push({
      variant: p.variant,
      label,
      ...(tooltip ? { tooltip } : {}),
      ...(typeof p.flag === "string" && p.flag ? { flag: p.flag.slice(0, 8) } : {}),
    });
  }

  const updated = await db
    .update(transferCities)
    .set({ pills: clean })
    .where(eq(transferCities.id, cityId))
    .returning({ id: transferCities.id });
  if (updated.length === 0) return { error: "invalid" };
  return { ok: true };
}
