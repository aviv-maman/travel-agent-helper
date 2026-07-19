/**
 * Generate the PWA app icons from an inline SVG (brand-blue square + a white
 * flight glyph) with sharp. Run once; the PNGs are committed. Reproducible:
 *   bun scripts/gen-pwa-icons.ts
 *
 * Outputs:
 *   public/icons/icon-192.png, icon-512.png       (purpose "any", rounded)
 *   public/icons/icon-maskable-512.png            (purpose "maskable", full-bleed + safe zone)
 *   app/icon.png                                  (favicon, rounded)
 *   app/apple-icon.png (180)                      (apple-touch, full-bleed square)
 */

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const BRAND = "#2563eb"; // matches --brand oklch(0.546 0.215 262.881)
const FLIGHT =
  "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z";

/** One icon SVG. `bleed` = full square background (maskable/apple); else rounded. `glyph` = glyph box fraction. */
function svg(size: number, { bleed = false, glyph = 0.56 } = {}): Buffer {
  const r = bleed ? 0 : Math.round(size * 0.22);
  const g = size * glyph;
  const off = (size - g) / 2;
  const scale = g / 24; // the flight path uses a 24×24 viewBox
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BRAND}"/>
      <g transform="translate(${off} ${off}) scale(${scale}) rotate(45 12 12)">
        <path d="${FLIGHT}" fill="#ffffff"/>
      </g>
    </svg>`,
  );
}

async function png(buf: Buffer, size: number, out: string) {
  await sharp(buf).resize(size, size).png().toFile(out);
  console.log("→", out);
}

mkdirSync("public/icons", { recursive: true });
await png(svg(512), 512, "public/icons/icon-512.png");
await png(svg(192), 192, "public/icons/icon-192.png");
await png(svg(512, { bleed: true, glyph: 0.44 }), 512, "public/icons/icon-maskable-512.png");
await png(svg(512), 512, "app/icon.png");
await png(svg(180, { bleed: true, glyph: 0.56 }), 180, "app/apple-icon.png");
console.log("done");
