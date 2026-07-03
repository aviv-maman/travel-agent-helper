import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User, type UserRole } from "@/db/schema";
import { USER_COOKIE } from "./public-user";

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
 * Create a session for `user` and set the cookies. Writes cookies, so call it
 * only from a Server Action or Route Handler (never during render). Also sets a
 * readable mirror cookie (public identity) for the client nav.
 */
export async function createSession(user: {
  id: number;
  username: string;
  role: UserRole;
}): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId: user.id, expiresAt });

  const store = await cookies();
  const base = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
  store.set(COOKIE_NAME, token, { httpOnly: true, ...base });
  store.set(USER_COOKIE, `${user.username}:${user.role}`, { httpOnly: false, ...base });
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
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(COOKIE_NAME);
  store.delete(USER_COOKIE);
}

/**
 * Delete every session for `userId` except the current device's — used after a
 * password change to sign out other devices while keeping this one active.
 */
export async function invalidateOtherSessions(userId: number): Promise<void> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const currentId = token ? hashToken(token) : null;
  await db
    .delete(sessions)
    .where(
      currentId
        ? and(eq(sessions.userId, userId), ne(sessions.id, currentId))
        : eq(sessions.userId, userId),
    );
}

/** Delete every session for `userId` (all devices) and clear the cookies. */
export async function invalidateUserSessions(userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
  const store = await cookies();
  store.delete(COOKIE_NAME);
  store.delete(USER_COOKIE);
}
