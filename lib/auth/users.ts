import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";

/**
 * All users (no password hashes), oldest first, with a count of their
 * *active* (non-expired) sessions — for the admin table's force-logout control.
 */
export async function listUsers() {
  return db
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
    .groupBy(users.id)
    .orderBy(asc(users.createdAt));
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>[number];
