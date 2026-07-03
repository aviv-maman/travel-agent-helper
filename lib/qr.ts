import { qrcodegen } from "./vendor/qrcodegen";

/**
 * Render `text` as a self-contained QR-code SVG data URI, using the vendored
 * MIT encoder (Project Nayuki). No external service is involved, so the otpauth
 * secret only ever reaches the same page the user is already looking at.
 *
 * The image is always pure black-on-white (a QR needs high contrast and must not
 * follow the app theme), with a 4-module quiet zone. ECC level "medium" is what
 * authenticator apps expect.
 */
export function qrDataUri(text: string): string {
  const border = 4;
  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM);
  const dim = qr.size + border * 2;

  // One SVG path made of 1×1 squares — compact and crisp at any size.
  let path = "";
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) path += `M${x + border},${y + border}h1v1h-1z`;
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="#fff"/>` +
    `<path d="${path}" fill="#000"/>` +
    `</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
