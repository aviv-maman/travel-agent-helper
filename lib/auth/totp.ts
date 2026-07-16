import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 TOTP + RFC 4648 Base32 + one-time backup codes — all on Node's
 * built-in crypto, no dependency. The secret is Base32 (what authenticator apps
 * expect); codes are the standard 6-digit / 30-second SHA-1 variant.
 */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/** New random Base32 TOTP secret (default 20 bytes = 160 bits). */
export function generateSecret(bytes = 20): string {
  return base32Encode(new Uint8Array(randomBytes(bytes)));
}

function hotp(secret: Uint8Array, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", Buffer.from(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return (bin % 1_000_000).toString().padStart(6, "0");
}

/** Current 6-digit code for a Base32 secret (mainly for tests). */
export function totp(secretBase32: string, time = Date.now()): string {
  return hotp(base32Decode(secretBase32), Math.floor(time / 1000 / 30));
}

/** Verify a code against the secret, allowing ±`window` 30s steps for clock skew. */
export function verifyTotp(secretBase32: string, code: string, window = 1): boolean {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const input = Buffer.from(clean);
  for (let i = -window; i <= window; i++) {
    const expected = Buffer.from(hotp(secret, counter + i));
    if (expected.length === input.length && timingSafeEqual(expected, input)) return true;
  }
  return false;
}

/** The otpauth:// URI an authenticator app imports (holds the secret). */
export function otpauthURI(opts: { secret: string; label: string; issuer: string }): string {
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(opts.issuer)}:${encodeURIComponent(
    opts.label,
  )}?${params.toString()}`;
}

/** Strip formatting so "ABCDE-12345" and "abcde12345" hash the same. */
export function normalizeBackupCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hashBackupCode(code: string): string {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}

/** New set of one-time backup codes, formatted "xxxxx-xxxxx". */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = base32Encode(new Uint8Array(randomBytes(7))).slice(0, 10).toLowerCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}
