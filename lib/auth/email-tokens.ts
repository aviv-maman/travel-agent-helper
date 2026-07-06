import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailTokens } from "@/db/schema";

/**
 * Single-use email tokens for verification + password reset
 * (docs/password-reset-contract.md). Like sessions, only the SHA-256 hash of the
 * raw token is stored — the raw token lives only in the emailed link, so a DB read
 * can't forge a valid link. Tokens are consumed atomically (marked used) and have
 * a short expiry.
 */

export type EmailTokenKind = "verify" | "reset";

const TTL_MS: Record<EmailTokenKind, number> = {
  verify: 24 * 60 * 60 * 1000, // 24h
  reset: 45 * 60 * 1000, // 45min
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a token of `kind` for `userId`; returns the RAW token (goes in the link). */
export async function createEmailToken(userId: number, kind: EmailTokenKind): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(emailTokens).values({
    id: hashToken(token),
    userId,
    kind,
    expiresAt: new Date(Date.now() + TTL_MS[kind]),
  });
  return token;
}

/**
 * Validate + consume a token. Returns the userId on success (and marks it used),
 * or null if it's unknown / wrong kind / expired / already used.
 */
export async function consumeEmailToken(
  token: string,
  kind: EmailTokenKind,
): Promise<number | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({ userId: emailTokens.userId })
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.id, id),
        eq(emailTokens.kind, kind),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db.update(emailTokens).set({ usedAt: new Date() }).where(eq(emailTokens.id, id));
  return row.userId;
}

/** Invalidate every outstanding token of `kind` for a user (on reset / password change). */
export async function invalidateEmailTokens(userId: number, kind: EmailTokenKind): Promise<void> {
  await db
    .update(emailTokens)
    .set({ usedAt: new Date() })
    .where(
      and(eq(emailTokens.userId, userId), eq(emailTokens.kind, kind), isNull(emailTokens.usedAt)),
    );
}
