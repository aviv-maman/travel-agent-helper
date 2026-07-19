"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contacts,
  supplierCommissions,
  suppliers,
  type BaggageRow,
  type SupplierCategory,
} from "@/db/schema";
import { can } from "@/lib/auth";
import { type CommissionInput } from "@/lib/commissions";
import { sectionForType, type ContactGroup } from "@/lib/contacts";
import {
  cleanContactGroups,
  validateBaggageRows,
  validateCommissionRows,
} from "@/lib/supplier-validation";

/**
 * Editor+ inline updates of a supplier's commission lines and baggage rows
 * (the suppliers-page pencil/+ buttons), plus the atomic create flow. The UI
 * only shows the controls to permitted users, but these re-checks are the real
 * security boundary. Validation lives in `lib/supplier-validation.ts` so the
 * inline saves and `createSupplierAction` agree.
 *
 * The app is the source of truth for these: the seed is bootstrap-only for
 * commission lines and baggage (like contacts), so `bun run seed` never
 * overwrites in-app edits. The lib/commissions.ts arrays remain the no-DB
 * fallback and the first-boot seed.
 *
 * No `revalidatePath`: the card calls `router.refresh()` on success.
 */

export type SaveResult = { ok: true } | { error: "forbidden" | "invalid" | "offline" };

export async function saveSupplierCommissionsAction(
  slug: string,
  rows: CommissionInput[],
): Promise<SaveResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };
  const clean = validateCommissionRows(rows);
  if (!clean) return { error: "invalid" };

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
  const clean = validateBaggageRows(rows);
  if (!clean) return { error: "invalid" };

  try {
    const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.slug, slug) });
    if (!supplier) return { error: "invalid" };
    await db.update(suppliers).set({ baggage: clean }).where(eq(suppliers.id, supplier.id));
    return { ok: true };
  } catch {
    return { error: "offline" };
  }
}

// ── Create a new supplier (editors) ──────────────────────────────────────────

const CATEGORIES: readonly SupplierCategory[] = ["flights", "hotels", "car-rental", "insurance"];

export type CreateSupplierInput = {
  category: SupplierCategory;
  name: string;
  code: string;
  website: string;
  /** Uploaded logo URL (bucket) or null for the placeholder. */
  logoUrl: string | null;
  commissions: CommissionInput[];
  /** Ignored unless category === "flights". */
  baggage: BaggageRow[];
  contacts: ContactGroup[];
};

export type CreateSupplierResult =
  | { ok: true; slug: string }
  | { error: "forbidden" | "invalid" | "offline" };

/** A URL-safe slug from a supplier name/code, deduped against existing rows. */
async function uniqueSupplierSlug(name: string, code: string): Promise<string> {
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  const base = slugify(name) || slugify(code) || "supplier";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`.slice(0, 48);
    const [hit] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.slug, slug));
    if (!hit) return slug;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 48);
}

/**
 * Create a supplier with its commissions, baggage (flights only), and contacts.
 * Near-atomic: on any failure after the parent insert we delete the parent, and
 * the FK cascade removes any child rows already written (the neon-http driver
 * has no interactive transactions).
 */
export async function createSupplierAction(
  input: CreateSupplierInput,
): Promise<CreateSupplierResult> {
  if (!(await can("content:edit"))) return { error: "forbidden" };

  const name = input.name.trim().slice(0, 120);
  const code = input.code.trim().slice(0, 24);
  const website = input.website.trim().slice(0, 2048);
  if (!name || !code || !website) return { error: "invalid" };
  if (!CATEGORIES.includes(input.category)) return { error: "invalid" };

  const commissions = validateCommissionRows(input.commissions);
  if (!commissions || commissions.length === 0) return { error: "invalid" };

  // Baggage is a flights concept — ignored for other categories.
  const baggage = input.category === "flights" ? validateBaggageRows(input.baggage) : [];
  if (baggage === null) return { error: "invalid" };

  const contactGroups = cleanContactGroups(input.contacts);
  if (contactGroups === null) return { error: "invalid" };

  let supplierId: number | null = null;
  try {
    const slug = await uniqueSupplierSlug(name, code);
    // New suppliers sort after the seed list (which increments from 0).
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${suppliers.sortOrder}), 0)` })
      .from(suppliers);
    const [row] = await db
      .insert(suppliers)
      .values({
        slug,
        name: { he: name, en: name },
        code,
        category: input.category,
        website,
        logo: input.logoUrl?.trim().slice(0, 2048) || null,
        baggage,
        notes: [],
        sortOrder: Number(max) + 1,
      })
      .returning({ id: suppliers.id });
    supplierId = row.id;

    await db
      .insert(supplierCommissions)
      .values(commissions.map((c) => ({ ...c, supplierId: row.id })));

    if (contactGroups.length) {
      await db.insert(contacts).values(
        contactGroups.map((g, i) => ({
          supplierId: row.id,
          section: sectionForType(g.type),
          type: g.type,
          label: g.label,
          phone: g.phone ?? "",
          email: g.email ?? "",
          active: g.active,
          sortOrder: i,
        })),
      );
    }
    return { ok: true, slug };
  } catch {
    // Compensate: drop the partial supplier (cascade removes any child rows).
    if (supplierId !== null) {
      try {
        await db.delete(suppliers).where(eq(suppliers.id, supplierId));
      } catch {
        /* best-effort rollback */
      }
    }
    return { error: "offline" };
  }
}
