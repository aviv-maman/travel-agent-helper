/**
 * Downloads supplier / airline logos (favicons) into public/{suppliers,airlines}/{id}.png.
 *
 * The id + website lists are read straight from the data files (lib/commissions.ts
 * for suppliers, lib/airlines.ts for airlines), so they always match the data.
 * Each card renders `logo ?? placeholder`, so dropping a file at
 * public/<dir>/{id}.png "upgrades" that supplier/airline.
 *
 * Usage (--type is required: "supplier" or "airline"):
 *   bun run logos --type supplier          # all suppliers
 *   bun run logos --type supplier israir   # one supplier
 *   bun run logos --type supplier --list   # list known supplier ids
 *   bun run logos --type airline           # all airlines
 *   bun run logos --type airline israir    # one airline
 *   bun run logos --type airline --list    # list known airline ids
 *
 * If some targets already have an icon, you're asked once whether to re-fetch
 * them (default: skip the existing ones).
 *
 * Source strategy: when LOGODEV_TOKEN is set (free key at https://logo.dev), the
 * logo.dev brand logo is tried first (bigger, transparent), then it falls back to
 * favicons — the page's <link> icons, /apple-touch-icon.png, Google (sz=256) and
 * DuckDuckGo — picking the largest. Without a token, only favicons are used.
 * (Clearbit's old free logo API has been shut down.)
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

type EntityType = "supplier" | "airline" | "news";
type Entity = { id: string; website: string };

/** Read id + website pairs from the commissions data (single source of truth). */
function readSuppliers(): Entity[] {
  const src = readFileSync(join(ROOT, "lib/commissions.ts"), "utf8");
  const out: Entity[] = [];
  const re = /id:\s*"([a-z-]+)",\s*\r?\n\s*website:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push({ id: m[1], website: m[2] });
  return out;
}

/**
 * Read id + website pairs from the baggage data. Airline objects have no nested
 * braces, so each `{ ... }` in the AIRLINES array is one airline.
 */
function readAirlines(): Entity[] {
  const src = readFileSync(join(ROOT, "lib/airlines.ts"), "utf8");
  const start = src.indexOf("const AIRLINES");
  const end = src.indexOf("\n];", start);
  if (start < 0 || end < 0) return [];
  const body = src.slice(start, end);
  const out: Entity[] = [];
  for (const m of body.matchAll(/\{[^{}]*\}/g)) {
    const obj = m[0];
    const id = obj.match(/id:\s*"([^"]+)"/)?.[1];
    const website = obj.match(/website:\s*"([^"]+)"/)?.[1];
    if (id && website) out.push({ id, website });
  }
  return out;
}

/**
 * Read id + homepage pairs from the news `SOURCES` registry. Each source object
 * has no nested braces, so `{ ... }` matches one source; we key the logo off the
 * source `base` (origin). Ids are unique across locales, so we de-dupe by id.
 */
function readNews(): Entity[] {
  const src = readFileSync(join(ROOT, "lib/news.ts"), "utf8");
  const start = src.indexOf("const SOURCES");
  const end = src.indexOf("\n};", start);
  if (start < 0 || end < 0) return [];
  const body = src.slice(start, end);
  const out: Entity[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(/\{[^{}]*\}/g)) {
    const obj = m[0];
    const id = obj.match(/id:\s*"([^"]+)"/)?.[1];
    const website = obj.match(/base:\s*"([^"]+)"/)?.[1];
    if (id && website && !seen.has(id)) {
      seen.add(id);
      out.push({ id, website });
    }
  }
  return out;
}

/** Ids that already have a downloaded icon in `dir` (any extension). */
function existingIcons(dir: string): Set<string> {
  try {
    return new Set(readdirSync(dir).map((f) => f.replace(/\.[^.]+$/, "")));
  } catch {
    return new Set();
  }
}

/** PNG dimensions area from the IHDR chunk; 0 if the buffer isn't a PNG. */
function pngArea(buf: Uint8Array): number {
  if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50) return 0;
  const dv = new DataView(buf.buffer, buf.byteOffset);
  return dv.getUint32(16) * dv.getUint32(20);
}

async function get(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.length > 70 ? buf : null;
  } catch {
    return null;
  }
}

/** Candidate icon URLs for a site, best-quality sources first. */
async function faviconCandidates(site: string): Promise<string[]> {
  const u = new URL(site);
  const out: string[] = [];
  try {
    const html = await (await fetch(site, { headers: { "User-Agent": UA } })).text();
    const links = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi) ?? [];
    for (const link of [...links.filter((l) => /apple-touch/i.test(l)), ...links]) {
      const href = link.match(/href=["']([^"']+)["']/i)?.[1];
      if (href) out.push(new URL(href, site).href);
    }
  } catch {}
  out.push(
    `${u.origin}/apple-touch-icon.png`,
    `${u.origin}/apple-touch-icon-precomposed.png`,
    `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=256`,
    `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`,
  );
  return [...new Set(out)];
}

/** Pick the largest PNG (or, if none, the biggest file) among candidate URLs. */
async function pickBest(urls: string[]): Promise<{ buf: Uint8Array; src: string } | null> {
  let best: { buf: Uint8Array; area: number; src: string } | null = null;
  for (const url of urls) {
    const buf = await get(url);
    if (!buf) continue;
    const area = pngArea(buf);
    if (!best || area > best.area || (best.area === 0 && buf.length > best.buf.length)) {
      best = { buf, area, src: url };
    }
  }
  return best;
}

/** Convert a non-PNG image to PNG in place using macOS `sips`, if available. */
function toPng(path: string): string {
  if (path.endsWith(".png")) return path;
  const png = path.replace(/\.[^.]+$/, ".png");
  const r = spawnSync("sips", ["-s", "format", "png", path, "--out", png], { stdio: "ignore" });
  if (r.status === 0) {
    rmSync(path, { force: true });
    return png;
  }
  return path; // sips missing — keep original
}

async function fetchOne(s: Entity, outDir: string): Promise<void> {
  const host = new URL(s.website).hostname.replace(/^www\./, "");
  const token = process.env.LOGODEV_TOKEN;
  // logo.dev first (when a token is set), then fall back to favicons.
  const logoUrls: string[] = [];
  if (token) {
    console.log("  · trying logo.dev brand logo…");
    logoUrls.push(`https://img.logo.dev/${host}?token=${token}&size=256&format=png&retina=true`);
  }
  console.log(`  · scanning ${host} for favicons…`);
  const urls = [...logoUrls, ...(await faviconCandidates(s.website))];

  console.log(`  · checking ${urls.length} candidate(s), picking the largest…`);
  const best = await pickBest(urls);
  if (!best) {
    console.log(`  ✗ ${s.id} — nothing found`);
    return;
  }
  const ext = pngArea(best.buf) > 0 ? "png" : best.src.split(".").pop()!.split("?")[0] || "ico";
  let file = join(outDir, `${s.id}.${ext}`);
  writeFileSync(file, best.buf);
  file = toPng(file);
  const dim =
    pngArea(best.buf) > 0 ? `~${Math.round(Math.sqrt(pngArea(best.buf)))}px` : "(converted)";
  console.log(`  ✓ ${s.id}  ${dim}  ← ${best.src}`);
}

async function main() {
  const args = process.argv.slice(2);
  const type = (args.includes("--type") ? args[args.indexOf("--type") + 1] : undefined) as
    EntityType | string | undefined;
  if (type !== "supplier" && type !== "airline" && type !== "news") {
    console.error("--type is required. Use --type supplier, --type airline or --type news.");
    process.exit(1);
  }

  const dirName = { supplier: "suppliers", airline: "airlines", news: "news" }[type];
  const outDir = join(ROOT, `public/${dirName}`);
  const entities =
    type === "airline" ? readAirlines() : type === "news" ? readNews() : readSuppliers();

  if (args.includes("--list")) {
    console.log(entities.map((s) => `${s.id}  ${s.website}`).join("\n"));
    return;
  }

  // Positional target id (anything that isn't a flag or a flag's value).
  const target = args.find((a) => !a.startsWith("-") && a !== type);
  let todo = target ? entities.filter((s) => s.id === target) : entities;
  if (todo.length === 0) {
    console.error(`No ${type} "${target}". Run with --list to see ids.`);
    process.exit(1);
  }

  // If some already have an icon, ask whether to re-fetch them (default: skip).
  const existing = existingIcons(outDir);
  const haveIcon = todo.filter((s) => existing.has(s.id));
  if (haveIcon.length) {
    const ans = prompt(
      `${haveIcon.length}/${todo.length} already have an icon. Re-fetch existing ones too? (y/N)`,
    );
    if (!/^y(es)?$/i.test(ans?.trim() ?? "")) {
      todo = todo.filter((s) => !existing.has(s.id));
      console.log(`Skipping ${haveIcon.length} existing; fetching ${todo.length}.`);
    }
  }
  if (todo.length === 0) {
    console.log("Nothing to fetch.");
    return;
  }

  if (!process.env.LOGODEV_TOKEN) {
    console.warn("⚠ LOGODEV_TOKEN not set (https://logo.dev); using favicons only.\n");
  }
  mkdirSync(outDir, { recursive: true });
  console.log(`Fetching ${todo.length} logo(s) → public/${dirName}/\n`);
  let done = 0;
  for (const s of todo) {
    console.log(`[${++done}/${todo.length}] ${s.id}  (${s.website})`);
    await fetchOne(s, outDir);
  }
  console.log(`\nDone — ${todo.length} processed → public/${dirName}/`);
}

main();
