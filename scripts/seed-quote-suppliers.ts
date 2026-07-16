/**
 * One-time bootstrap of the `quote_suppliers` table (the AI quote assistant's
 * supplier commissions) from the agent's published Google Sheet CSV — the data
 * source this table replaces. App-managed after bootstrap: the script refuses
 * to run when the table already has rows (edit in-app on the settings page).
 *
 * Run with a CSV file path or URL:
 *   bun scripts/seed-quote-suppliers.ts <path-or-url-to-suppliers-csv>
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}
const db = drizzle(neon(process.env.DATABASE_URL), { schema });

// Column headers exactly as the sheet publishes them (mirrors the backend's sheets.py).
const COLS = {
  nameEn: "שם ספק אנגלית",
  nameHe: "שם ספק עברית",
  baggageSuitcase: "מחיר כבודה - מזוודה",
  baggageTrolley: "מחיר כבודה - טרולי",
  netFlightNoStar: "נטו בטיסות בלבד - ללא כוכבית",
  netFlightStar: "נטו בטיסות בלבד - עם כוכבית",
  netPackageNoStar: "נטו בחבילות - ללא כוכבית",
  netPackageStar: "נטו בחבילות - עם כוכבית",
  notes: "הערות מיוחדות",
} as const;

/** Minimal RFC-4180 CSV parser (quoted fields may contain commas/newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, ""); // strip BOM
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/** "7.00%" / "5%" → bare "7" / "5"; "6.67%" → "6.67"; blank → null. */
function barePct(raw: string): string | null {
  const s = raw.trim().replace(/%$/, "").trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`unparseable percent: "${raw}"`);
  // Drop trailing zeros without losing precision ("7.00" → "7", "4.10" → "4.1").
  return String(n);
}

const src = process.argv[2];
if (!src) {
  console.error("usage: bun scripts/seed-quote-suppliers.ts <csv path or URL>");
  process.exit(1);
}

const existing = await db.select({ id: schema.quoteSuppliers.id }).from(schema.quoteSuppliers);
if (existing.length > 0) {
  console.log(
    `quote_suppliers already has ${existing.length} rows — app-managed, not reseeding.`,
  );
  process.exit(0);
}

const text = /^https?:\/\//.test(src)
  ? await (await fetch(src)).text()
  : await Bun.file(src).text();
const rows = parseCsv(text);
const header = rows[0];
const idx = Object.fromEntries(
  Object.entries(COLS).map(([key, title]) => [key, header.indexOf(title)]),
) as Record<keyof typeof COLS, number>;
for (const [key, i] of Object.entries(idx)) {
  if (i === -1) throw new Error(`column not found in CSV header: ${COLS[key as keyof typeof COLS]} (${key})`);
}

let sortOrder = 0;
const values = [];
for (const row of rows.slice(1)) {
  const cell = (key: keyof typeof COLS) => (row[idx[key]] ?? "").trim();
  if (!cell("nameEn")) continue;
  values.push({
    nameEn: cell("nameEn"),
    nameHe: cell("nameHe"),
    baggageSuitcase: cell("baggageSuitcase") || null,
    baggageTrolley: cell("baggageTrolley") || null,
    netFlightNoStar: barePct(cell("netFlightNoStar")),
    netFlightStar: barePct(cell("netFlightStar")),
    netPackageNoStar: barePct(cell("netPackageNoStar")),
    netPackageStar: barePct(cell("netPackageStar")),
    notes: cell("notes"),
    sortOrder: sortOrder++,
  });
}
if (values.length === 0) throw new Error("no data rows parsed — wrong CSV?");
await db.insert(schema.quoteSuppliers).values(values);
console.log(`Seeded ${values.length} quote suppliers.`);
