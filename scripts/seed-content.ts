/**
 * Seeds the content tables (suppliers, commissions, cancellations, airlines,
 * transfers, contacts) from the curated data arrays in lib/*.ts — the same
 * split as scripts/seed.ts ↔ data/seed.json: code is the source of truth, the
 * DB is the read source.
 *
 * Idempotent: parents (suppliers, airlines, transfer countries) are upserted
 * on slug; their child rows (commission lines, cancellation sets, cities) are
 * replaced wholesale on each run. Contacts are the exception — they are
 * editor-managed IN the app after launch, so they are only seeded when the
 * contacts table is empty (bootstrap), never overwritten.
 *
 * Run with: `bun run seed` (Bun auto-loads .env.local).
 */
import { eq, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { AIRLINES } from "../lib/airlines";
import { SUPPLIERS } from "../lib/commissions";
import {
  PRODUCT_ORDER,
  SUPPLIERS as CANCEL_SUPPLIERS,
} from "../lib/cancellations";
import { COUNTRIES } from "../lib/transfers";
import { DEFAULT_CONTACTS, sectionForType } from "../lib/contacts";

const {
  suppliers,
  supplierCommissions,
  supplierCancellations,
  airlines,
  contacts,
  transferCountries,
  transferCities,
} = schema;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}
const db = drizzle(neon(process.env.DATABASE_URL), { schema });

async function seedSuppliers(): Promise<Map<string, number>> {
  const slugToId = new Map<string, number>();
  const cancelBySlug = new Map(CANCEL_SUPPLIERS.map((c) => [c.id, c]));

  // Commissions is the primary supplier list; cancellation-only slugs (none
  // today, but supported) are appended after it in guide order.
  const extraCancelOnly = CANCEL_SUPPLIERS.filter(
    (c) => !SUPPLIERS.some((s) => s.id === c.id),
  );

  let sortOrder = 0;
  for (const s of SUPPLIERS) {
    const cancel = cancelBySlug.get(s.id);
    const [row] = await db
      .insert(suppliers)
      .values({
        slug: s.id,
        name: s.name,
        code: s.code,
        category: s.category ?? "flights",
        alias: s.alias ?? null,
        website: s.website ?? null,
        logo: s.logo ?? cancel?.logo ?? null,
        baggage: s.baggage,
        notes: s.notes ?? [],
        placeholder: Boolean(s.placeholder),
        sortOrder,
      })
      .onConflictDoUpdate({
        target: suppliers.slug,
        set: {
          name: s.name,
          code: s.code,
          category: s.category ?? "flights",
          alias: s.alias ?? null,
          website: s.website ?? null,
          logo: s.logo ?? cancel?.logo ?? null,
          baggage: s.baggage,
          notes: s.notes ?? [],
          placeholder: Boolean(s.placeholder),
          sortOrder,
        },
      })
      .returning();
    slugToId.set(s.id, row.id);
    sortOrder++;
  }

  for (const c of extraCancelOnly) {
    const [row] = await db
      .insert(suppliers)
      .values({
        slug: c.id,
        name: c.name,
        code: c.code,
        logo: c.logo ?? null,
        baggage: [],
        notes: [],
        sortOrder,
      })
      .onConflictDoUpdate({
        target: suppliers.slug,
        set: { name: c.name, code: c.code, logo: c.logo ?? null, sortOrder },
      })
      .returning();
    slugToId.set(c.id, row.id);
    sortOrder++;
  }

  return slugToId;
}

async function seedCommissionLines(slugToId: Map<string, number>): Promise<number> {
  let total = 0;
  for (const s of SUPPLIERS) {
    const supplierId = slugToId.get(s.id)!;
    await db
      .delete(supplierCommissions)
      .where(eq(supplierCommissions.supplierId, supplierId));

    const rows: (typeof supplierCommissions.$inferInsert)[] = [];
    if (s.flightsOnly) {
      rows.push({
        supplierId,
        kind: "flights",
        value: s.flightsOnly.value,
        level: s.flightsOnly.level,
      });
    }
    if (s.packages) {
      rows.push({
        supplierId,
        kind: "packages",
        value: s.packages.value,
        level: s.packages.level,
      });
    }
    if (s.organizedTours) {
      rows.push({
        supplierId,
        kind: "organized",
        value: s.organizedTours.value,
        level: s.organizedTours.level,
      });
    }
    [s.customCommission1, s.customCommission2, s.customCommission3]
      .filter((cm): cm is NonNullable<typeof cm> => Boolean(cm))
      .forEach((cm, i) => {
        rows.push({
          supplierId,
          kind: "custom",
          label: cm.label,
          value: cm.value,
          level: cm.level,
          sortOrder: i,
        });
      });
    if (rows.length) await db.insert(supplierCommissions).values(rows);
    total += rows.length;
  }
  return total;
}

async function seedCancellations(slugToId: Map<string, number>): Promise<number> {
  let sortOrder = 0;
  for (const c of CANCEL_SUPPLIERS) {
    const supplierId = slugToId.get(c.id)!;
    // Store products pre-sorted: the UI renders them as stored (the in-code
    // sort uses PRODUCT_ORDER reference identity, which JSON round-trips lose).
    const products = [...c.products]
      .sort((a, b) => PRODUCT_ORDER.indexOf(a) - PRODUCT_ORDER.indexOf(b))
      .map((p) => ({ kind: p.kind, label: p.label }));

    await db
      .delete(supplierCancellations)
      .where(eq(supplierCancellations.supplierId, supplierId));
    await db
      .insert(supplierCancellations)
      .values({ supplierId, products, blocks: c.blocks, sortOrder });
    sortOrder++;
  }
  return CANCEL_SUPPLIERS.length;
}

async function seedAirlines(): Promise<Map<string, number>> {
  const slugToId = new Map<string, number>();
  let sortOrder = 0;
  for (const a of AIRLINES) {
    const values = {
      slug: a.id,
      iata: a.iata ?? null,
      flag: a.flag ?? null,
      name: a.name,
      kg: a.kg,
      note: a.note ?? null,
      noteTone: a.noteTone ?? null,
      info: a.info ?? null,
      website: a.website,
      highlight: Boolean(a.highlight),
      commission: a.commission ?? null,
      sortOrder,
    };
    const [row] = await db
      .insert(airlines)
      .values(values)
      .onConflictDoUpdate({ target: airlines.slug, set: values })
      .returning();
    slugToId.set(a.id, row.id);
    sortOrder++;
  }
  return slugToId;
}

async function seedTransfers(): Promise<{ countries: number; cities: number }> {
  let cities = 0;
  let sortOrder = 0;
  for (const c of COUNTRIES) {
    const values = {
      slug: c.id,
      country: c.country,
      code: c.code,
      sortOrder,
    };
    const [country] = await db
      .insert(transferCountries)
      .values(values)
      .onConflictDoUpdate({ target: transferCountries.slug, set: values })
      .returning();
    sortOrder++;

    // Replace this country's cities wholesale (same as hotels per destination).
    await db
      .delete(transferCities)
      .where(eq(transferCities.countryId, country.id));
    await db.insert(transferCities).values(
      c.cities.map((city, i) => ({
        countryId: country.id,
        slug: city.id,
        name: city.name,
        search: city.search,
        pills: city.pills.map((p) => ({
          variant: p.variant,
          flag: p.flag,
          label: p.label,
          tooltip: p.tooltip,
        })),
        sortOrder: i,
      })),
    );
    cities += c.cities.length;
  }
  return { countries: COUNTRIES.length, cities };
}

/**
 * Bootstrap-only: contacts become editor-managed data once in the DB, so an
 * existing (possibly edited) table is never touched by re-runs.
 */
async function seedContacts(
  supplierSlugToId: Map<string, number>,
  airlineSlugToId: Map<string, number>,
): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts);
  if (count > 0) {
    console.log(`  contacts: table already has ${count} rows — skipped (app-managed)`);
    return 0;
  }

  let inserted = 0;
  for (const [key, contact] of Object.entries(DEFAULT_CONTACTS)) {
    // Keys are supplier slugs; airline entries use the "air:{slug}" prefix.
    const owner = key.startsWith("air:")
      ? { airlineId: airlineSlugToId.get(key.slice(4)) }
      : { supplierId: supplierSlugToId.get(key) };
    if (!owner.supplierId && !owner.airlineId) {
      console.warn(`  contacts: no supplier/airline row for "${key}" — skipped`);
      continue;
    }

    const groups = [
      ...(contact.general ?? []),
      ...(contact.sales ?? []),
      ...(contact.agents ?? []),
    ];
    if (!groups.length) continue;
    await db.insert(contacts).values(
      groups.map((g, i) => ({
        ...owner,
        section: sectionForType(g.type),
        type: g.type,
        label: g.label,
        phone: g.phone ?? "",
        email: g.email ?? "",
        active: g.active,
        sortOrder: i,
      })),
    );
    inserted += groups.length;
  }
  return inserted;
}

async function main() {
  const supplierIds = await seedSuppliers();
  const commissionLines = await seedCommissionLines(supplierIds);
  const cancellations = await seedCancellations(supplierIds);
  const airlineIds = await seedAirlines();
  const transfers = await seedTransfers();
  const contactRows = await seedContacts(supplierIds, airlineIds);

  console.log(
    `Seeded ${supplierIds.size} suppliers (${commissionLines} commission lines, ` +
      `${cancellations} cancellation sets), ${airlineIds.size} airlines, ` +
      `${transfers.countries} transfer countries / ${transfers.cities} cities, ` +
      `${contactRows} contact rows.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
