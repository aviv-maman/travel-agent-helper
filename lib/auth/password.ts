import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing with Node's built-in scrypt (no external dependency).
 *
 * A random per-password salt defends against rainbow tables; scrypt's cost makes
 * brute-forcing expensive; `timingSafeEqual` avoids leaking the answer via how
 * long the comparison takes. The stored string is self-describing so we can bump
 * the algorithm/params later without a migration: "scrypt:<saltHex>:<hashHex>".
 */

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH)) as Buffer;
  // Length check first: timingSafeEqual throws if the buffers differ in length.
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
