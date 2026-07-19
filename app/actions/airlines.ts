"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { airlines } from "@/db/schema";
import type { Localized } from "@/db/schema";
import { can } from "@/lib/auth";
import { FIGURE_RE, bareFigure } from "@/lib/airline-figures";
import { codeToFlag, flagToCode } from "@/lib/airlines";

/**
 * Editor+ inline update of one airline row (the pencil on the airlines table):
 * suitcase kg, trolley kg, and commission. Values arrive and are stored as bare
 * figures ("23", "15/23", "0/5") — the ק"ג / % units are presentation only.
 *
 * These three fields are app-managed after bootstrap: `bun run seed` upserts an
 * airline's metadata but leaves kg/note/commission alone (see seed-content.ts),
 * so in-app edits survive re-seeds.
 *
 * No `revalidatePath`: the table calls `router.refresh()` on success (the
 * house convention for inline editors).
 */

export type SaveAirlineResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };

export async function saveAirlineRowAction(
  slug: string,
  patch: {
    kg: string;
    commission: string;
    /** Omitted = leave the trolley note untouched; "" clears it. */
    trolley?: string;
  },
): Promise<SaveAirlineResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };

  const kg = bareFigure(patch.kg).slice(0, 16);
  if (!FIGURE_RE.test(kg)) return { error: "invalid" };
  const commission = bareFigure(patch.commission).slice(0, 16);
  if (commission && !FIGURE_RE.test(commission)) return { error: "invalid" };

  const set: Partial<typeof airlines.$inferInsert> = {
    kg,
    commission: commission || null, // null renders as "0%"
  };
  if (patch.trolley !== undefined) {
    const trolley = bareFigure(patch.trolley).slice(0, 16);
    if (!trolley) {
      set.note = null;
      set.noteTone = null;
    } else if (FIGURE_RE.test(trolley)) {
      set.note = { he: `${trolley} ק"ג`, en: `${trolley} kg` };
      set.noteTone = null;
    } else {
      return { error: "invalid" };
    }
  }

  try {
    const updated = await db
      .update(airlines)
      .set(set)
      .where(eq(airlines.slug, slug.slice(0, 48)))
      .returning({ id: airlines.id });
    if (updated.length === 0) return { error: "invalid" };
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

// ── Full add / edit / delete (editors) ──────────────────────────────────────

/** The airline form's fields (raw, before figure/localized normalization). One
 *  name for both locales; flag is a 2-letter country code; trolley is a bare kg
 *  figure (the "kg" unit is added on display, like the suitcase). */
export type AirlineInput = {
  name: string;
  iata: string;
  /** 2-letter ISO country code, e.g. "IL" (stored as a flag emoji). */
  flagCode: string;
  kg: string;
  /** Bare trolley figure, e.g. "8" — the unit is added for display. */
  trolley: string;
  website: string;
  commission: string;
  /** Uploaded logo URL (bucket) or null to keep the static/placeholder logo. */
  logoUrl: string | null;
};

export type AirlineDraft = AirlineInput & { slug: string; custom: boolean };

const trim = (s: string, n = 160) => s.trim().slice(0, n);

/** slug from the English name, deduped against existing rows. */
async function uniqueSlug(nameEn: string): Promise<string> {
  const base =
    nameEn
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "airline";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`.slice(0, 48);
    const [hit] = await db.select({ id: airlines.id }).from(airlines).where(eq(airlines.slug, slug));
    if (!hit) return slug;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 48);
}

type AirlineRow = {
  name: Localized;
  iata: string | null;
  flag: string | null;
  kg: string;
  note: Localized | null;
  info: Localized | null;
  website: string;
  commission: string | null;
  logoUrl: string | null;
};

/** Validate + shape the form input into a row patch. `null` = invalid.
 *  Required: name, iata, kg, trolley, commission. Optional: flag code, website. */
function toRow(input: AirlineInput): AirlineRow | null {
  const name = trim(input.name);
  const iata = trim(input.iata, 16);
  if (!name || !iata) return null;
  const kg = bareFigure(input.kg).slice(0, 16);
  const trolley = bareFigure(input.trolley).slice(0, 16);
  const commission = bareFigure(input.commission).slice(0, 16);
  if (!FIGURE_RE.test(kg) || !FIGURE_RE.test(trolley) || !FIGURE_RE.test(commission)) return null;
  return {
    name: { he: name, en: name },
    iata,
    flag: codeToFlag(input.flagCode),
    kg,
    // Trolley stored like the inline editor: a plain kg figure with the unit.
    note: { he: `${trolley} ק"ג`, en: `${trolley} kg` },
    info: null,
    website: input.website.trim().slice(0, 2048), // optional (column is "" when blank)
    commission,
    logoUrl: input.logoUrl?.trim().slice(0, 2048) || null,
  };
}

export type MutateResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };

export async function createAirlineAction(input: AirlineInput): Promise<MutateResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  const row = toRow(input);
  if (!row) return { error: "invalid" };
  try {
    const slug = await uniqueSlug(row.name.en || row.name.he || "airline");
    // New airlines sort after the seed list (which ends well under 1000).
    await db.insert(airlines).values({ ...row, slug, custom: true, sortOrder: 1000 });
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

export async function updateAirlineAction(slug: string, input: AirlineInput): Promise<MutateResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  const row = toRow(input);
  if (!row) return { error: "invalid" };
  try {
    const updated = await db
      .update(airlines)
      .set(row)
      .where(eq(airlines.slug, slug.slice(0, 48)))
      .returning({ id: airlines.id });
    if (updated.length === 0) return { error: "invalid" };
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

export async function deleteAirlineAction(slug: string): Promise<MutateResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  try {
    // Only app-added airlines are deletable; seed rows stay (they'd re-appear on
    // the next `bun run seed` anyway). The custom guard makes that authoritative.
    const deleted = await db
      .delete(airlines)
      .where(and(eq(airlines.slug, slug.slice(0, 48)), eq(airlines.custom, true)))
      .returning({ id: airlines.id });
    if (deleted.length === 0) return { error: "invalid" };
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

/** Raw fields for the edit form (editors only). Null when the slug is unknown. */
export async function airlineDraftAction(slug: string): Promise<AirlineDraft | null> {
  if (!(await can("content:edit"))) return null;
  const [a] = await db.select().from(airlines).where(eq(airlines.slug, slug.slice(0, 48)));
  if (!a) return null;
  return {
    slug: a.slug,
    custom: a.custom,
    name: a.name.he ?? a.name.en ?? "",
    iata: a.iata ?? "",
    flagCode: (flagToCode(a.flag ?? undefined) ?? "").toUpperCase(),
    kg: a.kg,
    trolley: bareFigure(a.note?.he ?? a.note?.en ?? ""),
    website: a.website,
    commission: (a.commission ?? "").replace(/%/g, ""),
    logoUrl: a.logoUrl ?? null,
  };
}
