import "server-only";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

/**
 * AES-256-GCM encryption for TOTP secrets at rest.
 * Format: "v1:<nonce>:<ciphertext+tag>" — matches project-gg-claude's pattern.
 * The encryption key lives in env (TOTP_ENC_KEY), never in the DB.
 */

function getKey(): Buffer {
  const key = process.env.TOTP_ENC_KEY;
  if (!key) {
    throw new Error("TOTP_ENC_KEY not set — cannot encrypt/decrypt TOTP secrets");
  }
  const buffer = Buffer.from(key, "base64");
  if (buffer.length !== 32) {
    throw new Error("TOTP_ENC_KEY must be base64 of exactly 32 bytes");
  }
  return buffer;
}

/**
 * Encrypt a TOTP secret (Base32 string).
 * Returns: "v1:<nonce_b64>:<ciphertext_b64>"
 */
export function encryptTotpSecret(secret: string): string {
  const key = getKey();
  const nonce = randomBytes(12); // 96-bit GCM nonce
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const nonceb64 = nonce.toString("base64");
  const ciphertextb64 = ciphertext.toString("base64");
  return `v1:${nonceb64}:${ciphertextb64}`;
}

/**
 * Decrypt a TOTP secret stored in "v1:<nonce_b64>:<ciphertext_b64>" format.
 * Returns the original Base32 secret string.
 */
export function decryptTotpSecret(encrypted: string): string {
  const key = getKey();
  const [version, nonceb64, ciphertextb64] = encrypted.split(":");
  if (version !== "v1") {
    throw new Error(`Unknown encryption version: ${version}`);
  }
  const nonce = Buffer.from(nonceb64, "base64");
  const ciphertextAndTag = Buffer.from(ciphertextb64, "base64");

  // Split: last 16 bytes are the GCM tag, rest is ciphertext
  const ciphertext = ciphertextAndTag.subarray(0, ciphertextAndTag.length - 16);
  const tag = ciphertextAndTag.subarray(ciphertextAndTag.length - 16);

  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
