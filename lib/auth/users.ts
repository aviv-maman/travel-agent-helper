import "server-only";
import { asc, count, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";

const PER_PAGE = 20;

/**
 * One user's public-facing record (no password hash), or null when not found —
 * for the admin user-detail page. Sessions are fetched separately via
 * `listSessions` so this stays a single-row lookup.
 */
export async function getUserDetail(id: number) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      createdAt: users.createdAt,
      totpEnabledAt: users.totpEnabledAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}

export type UserDetail = NonNullable<Awaited<ReturnType<typeof getUserDetail>>>;

/**
 * A page of users (no password hashes), oldest first, each with a count of their
 * *active* (non-expired) sessions. Optional `search` filters by username.
 */
export async function listUsers(opts: { search?: string; page?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const search = opts.search?.trim();
  const where = search ? ilike(users.username, `%${search}%`) : undefined;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
      sessionCount: sql<number>`count(${sessions.id}) filter (where ${sessions.expiresAt} > now())`.mapWith(
        Number,
      ),
      lastActive: sql<Date | null>`max(${sessions.lastSeenAt})`.mapWith(sessions.lastSeenAt),
    })
    .from(users)
    .leftJoin(sessions, eq(sessions.userId, users.id))
    .where(where)
    .groupBy(users.id)
    .orderBy(asc(users.createdAt))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE);

  const [{ total }] = await db.select({ total: count() }).from(users).where(where);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
  };
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>["rows"][number];
