import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/** All users (no password hashes), oldest first, for the admin table. */
export async function listUsers() {
  return db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>[number];
