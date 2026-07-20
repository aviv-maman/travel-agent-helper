/**
 * Backfill destinations.landmarkGeo from the add-destination skill's work files.
 *
 * The DB `landmarks` table stores only key + name; the geometry needed to compute
 * distances for a NEW hotel (street polylines / area rings / point coords) lives
 * in the skill's per-destination work dir (`data/destinations/work/<code>/{input.json,
 * geo_cache.json}`). This one-time script reshapes that geometry into
 * `destinations.landmarkGeo`, keyed by the matching `landmarks.key`, so the in-app
 * add-hotel enrichment can reproduce distances server-side.
 *
 * Usage:
 *   bun scripts/backfill-landmark-geo.ts            # dry-run report
 *   bun scripts/backfill-landmark-geo.ts --yes      # write to the DB
 */

import { readFileSync, existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LandmarkGeo, LandmarkGeoPoint } from "@/db/schema";

const { destinations } = schema;
const WRITE = process.argv.includes("--yes");
const WORK = "data/destinations/work";

type RefPoint = {
  name_he?: string;
  type: "street" | "area" | "point";
  osm_name?: string;
  query?: string;
  start?: "north" | "south" | "east" | "west";
  lat?: number;
  lng?: number;
};

/** Locate a destination's work dir: bare `<code>` (new) or `audit-<code>` (legacy). */
function workDir(iata: string): string | null {
  const code = iata.toLowerCase();
  for (const name of [code, `audit-${code}`]) {
    if (existsSync(`${WORK}/${name}/input.json`)) return `${WORK}/${name}`;
  }
  return null;
}

/** Map each reference point to a landmark key: exact key match first, then by order. */
function assignKeys(refs: RefPoint[], dbKeys: string[]): (string | null)[] {
  const out: (string | null)[] = refs.map(() => null);
  const taken = new Set<string>();
  // Pass 1: name_he is already the latin key.
  refs.forEach((r, i) => {
    if (r.name_he && dbKeys.includes(r.name_he) && !taken.has(r.name_he)) {
      out[i] = r.name_he;
      taken.add(r.name_he);
    }
  });
  // Pass 2: fill the rest in order from the unused keys.
  const free = dbKeys.filter((k) => !taken.has(k));
  let f = 0;
  out.forEach((v, i) => {
    if (v === null && f < free.length) out[i] = free[f++];
  });
  return out;
}

/** Extract clean geometry for one reference point from the geo cache. */
function geometryFor(
  r: RefPoint,
  cache: Record<string, unknown>,
): Omit<LandmarkGeoPoint, "key"> | { error: string } {
  if (r.type === "point") {
    if (typeof r.lat === "number" && typeof r.lng === "number") {
      return { type: "point", point: [r.lat, r.lng] };
    }
    const g = r.query ? (cache[`geo::${r.query}`] as { lat: number; lon: number } | null) : null;
    if (g && typeof g.lat === "number") return { type: "point", point: [g.lat, g.lon] };
    return { error: `point geo missing (${r.query ?? "no query/coords"})` };
  }
  if (r.type === "area") {
    const a = r.query
      ? (cache[`area::${r.query}`] as { rings: [number, number][][]; lat: number; lon: number } | null)
      : null;
    if (a?.rings?.length) return { type: "area", rings: a.rings, center: [a.lat, a.lon] };
    return { error: `area rings missing (${r.query ?? "no query"})` };
  }
  // street: the cache key carries a bbox suffix — match by prefix.
  const prefix = `street::${r.osm_name}::`;
  const key = Object.keys(cache).find((k) => k.startsWith(prefix));
  const segs = key ? (cache[key] as [number, number][][]) : null;
  if (segs?.length) return { type: "street", ...(r.start ? { start: r.start } : {}), segments: segs };
  return { error: `street segments missing (${r.osm_name ?? "no osm_name"})` };
}

async function main() {
  const dests = await db.query.destinations.findMany({
    columns: { id: true, iata: true },
    with: { landmarks: { columns: { key: true } } },
  });

  let written = 0;
  for (const d of dests.sort((a, b) => a.iata.localeCompare(b.iata))) {
    const dbKeys = d.landmarks.map((l) => l.key);
    const dir = workDir(d.iata);
    if (!dir) {
      console.log(`${d.iata}: ⚠ no work dir — distances unavailable for new hotels`);
      continue;
    }
    const input = JSON.parse(readFileSync(`${dir}/input.json`, "utf8"));
    const cache = existsSync(`${dir}/geo_cache.json`)
      ? JSON.parse(readFileSync(`${dir}/geo_cache.json`, "utf8"))
      : {};
    const refs: RefPoint[] = input.reference_points ?? [];
    const keys = assignKeys(refs, dbKeys);

    const points: LandmarkGeoPoint[] = [];
    const issues: string[] = [];
    refs.forEach((r, i) => {
      const key = keys[i];
      if (!key) {
        issues.push(`ref#${i} (${r.name_he}) → no landmark key`);
        return;
      }
      const geo = geometryFor(r, cache);
      if ("error" in geo) {
        issues.push(`${key}: ${geo.error}`);
        return;
      }
      points.push({ key, ...geo });
    });

    const covered = points.map((p) => p.key);
    const missing = dbKeys.filter((k) => !covered.includes(k));
    const flag = missing.length ? `⚠ missing ${missing.join(",")}` : "✓";
    console.log(
      `${d.iata}: ${points.length}/${dbKeys.length} landmarks ${flag}` +
        (issues.length ? ` — ${issues.join("; ")}` : ""),
    );

    if (WRITE && points.length) {
      const geo: LandmarkGeo = { points };
      await db.update(destinations).set({ landmarkGeo: geo }).where(eq(destinations.id, d.id));
      written++;
    }
  }

  console.log(WRITE ? `\nWrote landmarkGeo for ${written} destinations.` : "\nDry-run. Re-run with --yes to write.");
}

main().then(() => process.exit(0));
