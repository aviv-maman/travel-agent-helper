import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

/**
 * Failed-login throttling, keyed by **client IP**. DB-backed so it holds across
 * serverless instances (an in-memory counter wouldn't). After MAX_FAILURES
 * failures inside WINDOW, the key is locked for LOCKOUT.
 *
 * Keying on IP (not username) throttles the attacker's source and avoids letting
 * anyone lock a known account out of spite. Tradeoff: many users behind one NAT
 * share a bucket — fine for a small internal tool with a generous threshold.
 */

const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

/** Best-effort client IP from proxy headers; a stable fallback when unknown. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 60);
  return (h.get("x-real-ip") ?? "unknown").slice(0, 60);
}

/** Whether `key` is currently locked out. */
export async function isLocked(key: string): Promise<boolean> {
  const [row] = await db
    .select({ lockedUntil: loginAttempts.lockedUntil })
    .from(loginAttempts)
    .where(eq(loginAttempts.key, key))
    .limit(1);
  return !!row?.lockedUntil && row.lockedUntil.getTime() > Date.now();
}

/** Record a failed attempt, opening or extending the window and locking if tripped. */
export async function recordFailure(key: string): Promise<void> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.key, key))
    .limit(1);

  if (!row) {
    await db.insert(loginAttempts).values({ key, count: 1, windowStartsAt: now });
    return;
  }

  const windowElapsed = now.getTime() - row.windowStartsAt.getTime() > WINDOW_MS;
  const count = windowElapsed ? 1 : row.count + 1;
  await db
    .update(loginAttempts)
    .set({
      count,
      windowStartsAt: windowElapsed ? now : row.windowStartsAt,
      lockedUntil: count >= MAX_FAILURES ? new Date(now.getTime() + LOCKOUT_MS) : null,
    })
    .where(eq(loginAttempts.key, key));
}

/** Clear the counter after a successful login. */
export async function clearAttempts(key: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}
