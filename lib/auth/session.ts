import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";

/**
 * Server-side session store. The cookie holds an opaque random token; the DB
 * stores only its SHA-256 hash as the row id, so the raw token never lives in
 * the database. Sessions are revocable (delete the row) and cascade-deleted with
 * their user.
 */

const COOKIE_NAME = "session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a session for `userId` and set the cookie. Writes a cookie, so call it
 * only from a Server Action or Route Handler (never during render).
 */
export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Resolve the signed-in user from the session cookie, or null. Read-only (no
 * cookie writes), so it is safe to call during render.
 */
export async function validateSession(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [found] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);
  if (!found || found.expiresAt.getTime() < Date.now()) return null;
  return found.user;
}

/**
 * Delete the current session and clear the cookie. Writes a cookie, so call it
 * only from a Server Action or Route Handler.
 */
export async function invalidateSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(COOKIE_NAME);
}
