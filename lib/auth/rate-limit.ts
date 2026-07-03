import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

/**
 * Failed-login throttling, keyed by username. DB-backed so it holds across
 * serverless instances (an in-memory counter wouldn't). After MAX_FAILURES
 * failures inside WINDOW, the key is locked for LOCKOUT.
 *
 * Note: locking by username means an attacker can lock out a known account
 * (a mild DoS). Acceptable for a small internal tool; switch the key to the
 * client IP if that becomes a concern.
 */

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

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
