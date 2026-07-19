/**
 * Generate the PWA app icons from the brand logo (public/brand/logo.png) with
 * sharp. The source is a 1024×1024 render of the "M" mark on a rounded white
 * card (with shadow); this extracts just the artwork and re-composites it,
 * centred, on a clean full-bleed white square so the OS applies its own icon
 * mask (no double-rounded corners / clipping). Run once; the PNGs are committed:
 *   bun scripts/gen-pwa-icons.ts
 *
 * Outputs: public/icons/icon-{192,512}.png, icon-maskable-512.png,
 *          app/icon.png (favicon), app/apple-icon.png (180 apple-touch).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SRC = "public/brand/logo.png";
// Region of the source that bounds the full mark — the "M" plus the faint globe
// beneath it — inside the card, past the rounded corners + shadow. Tuned to this
// 1024×1024 logo. (No auto-trim: the pale globe would be trimmed as near-white.)
const CROP = { left: 232, top: 180, width: 566, height: 625 };

/** The mark (M + globe) flattened on white, cropped to its bounding box. */
async function artwork(): Promise<Buffer> {
  return sharp(SRC).flatten({ background: "#ffffff" }).extract(CROP).png().toBuffer();
}

/** Center the artwork on a white square of `size`; `inner` = art box fraction. */
async function compose(art: Buffer, size: number, inner: number): Promise<Buffer> {
  const box = Math.round(size * inner);
  const fitted = await sharp(art)
    .resize(box, box, { fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: "#ffffff" } })
    .composite([{ input: fitted, gravity: "center" }])
    .png()
    .toBuffer();
}

async function icon(art: Buffer, size: number, inner: number, out: string) {
  writeFileSync(out, await compose(art, size, inner));
  console.log("→", out);
}

/** Wrap a 256×256 PNG in a single-image ICO container (PNG-in-ICO, Vista+). */
function pngToIco(png: Buffer): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // width 256 → 0
  entry.writeUInt8(0, 1); // height 256 → 0
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12); // offset (6 + 16)
  return Buffer.concat([header, entry, png]);
}

mkdirSync("public/icons", { recursive: true });
const art = await artwork();
await icon(art, 512, 0.82, "public/icons/icon-512.png");
await icon(art, 192, 0.82, "public/icons/icon-192.png");
// Maskable: extra padding so Android's circle/squircle crop never clips the mark.
await icon(art, 512, 0.68, "public/icons/icon-maskable-512.png");
await icon(art, 512, 0.82, "app/icon.png");
await icon(art, 180, 0.84, "app/apple-icon.png");
// Browser-tab favicon (256 PNG-in-ICO) so the tab matches the new logo.
writeFileSync("app/favicon.ico", pngToIco(await compose(art, 256, 0.86)));
console.log("→ app/favicon.ico");
console.log("done");
