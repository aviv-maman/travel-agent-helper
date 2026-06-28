/**
 * Downloads supplier logos / favicons into public/suppliers/{id}.png.
 *
 * The supplier list (id + website) is read straight from lib/commissions.ts, so
 * it always matches the data. Each supplier's card renders `logo ?? placeholder`,
 * so dropping a file at public/suppliers/{id}.png "upgrades" that supplier.
 *
 * Usage:
 *   bun run logos                 # all suppliers, favicon mode
 *   bun run logos israir          # one supplier
 *   bun run logos -- --mode logo  # all suppliers, brand-logo mode (logo.dev)
 *   bun run logos israir --mode logo
 *   bun run logos --list          # list known supplier ids
 *
 * Modes:
 *   favicon (default) — best favicon across the page's <link> icons,
 *                       /apple-touch-icon.png, Google (sz=256) and DuckDuckGo.
 *   logo              — try the logo.dev brand logo first (bigger, transparent),
 *                       then fall back to the favicon strategy. Needs a token:
 *                       set LOGODEV_TOKEN (free key at https://logo.dev). Without
 *                       it, logo mode just behaves like favicon mode.
 *                       (Clearbit's old free logo API has been shut down.)
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const OUT = join(ROOT, "public/suppliers");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

type Supplier = { id: string; website: string };

/** Read id + website pairs from the commissions data (single source of truth). */
function readSuppliers(): Supplier[] {
  const src = readFileSync(join(ROOT, "lib/commissions.ts"), "utf8");
  const out: Supplier[] = [];
  const re = /id:\s*"([a-z-]+)",\s*\r?\n\s*website:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push({ id: m[1], website: m[2] });
  return out;
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

async function fetchOne(s: Supplier, mode: "favicon" | "logo"): Promise<void> {
  const host = new URL(s.website).hostname.replace(/^www\./, "");
  const token = process.env.LOGODEV_TOKEN;
  const logoUrls =
    mode === "logo" && token
      ? [`https://img.logo.dev/${host}?token=${token}&size=256&format=png&retina=true`]
      : [];
  const urls = [...logoUrls, ...(await faviconCandidates(s.website))];

  const best = await pickBest(urls);
  if (!best) {
    console.log(`✗ ${s.id} — nothing found`);
    return;
  }
  const ext = pngArea(best.buf) > 0 ? "png" : best.src.split(".").pop()!.split("?")[0] || "ico";
  let file = join(OUT, `${s.id}.${ext}`);
  writeFileSync(file, best.buf);
  file = toPng(file);
  const dim =
    pngArea(best.buf) > 0 ? `~${Math.round(Math.sqrt(pngArea(best.buf)))}px` : "(converted)";
  console.log(`✓ ${s.id}  ${dim}  ← ${best.src}`);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = (args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "favicon") as
    | "favicon"
    | "logo";
  const suppliers = readSuppliers();

  if (args.includes("--list")) {
    console.log(suppliers.map((s) => `${s.id}  ${s.website}`).join("\n"));
    return;
  }

  const target = args.find((a) => !a.startsWith("-") && a !== mode);
  const todo = target ? suppliers.filter((s) => s.id === target) : suppliers;
  if (todo.length === 0) {
    console.error(`No supplier "${target}". Run with --list to see ids.`);
    process.exit(1);
  }

  if (mode === "logo" && !process.env.LOGODEV_TOKEN) {
    console.warn("⚠ logo mode needs LOGODEV_TOKEN (https://logo.dev); falling back to favicons.\n");
  }
  mkdirSync(OUT, { recursive: true });
  console.log(`Fetching ${todo.length} logo(s) in "${mode}" mode → public/suppliers/`);
  for (const s of todo) await fetchOne(s, mode);
}

main();
