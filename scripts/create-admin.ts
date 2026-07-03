/**
 * Bootstraps (or resets) an admin user — run once to get into the app.
 *
 *   bun run create-admin <username> <password>
 *
 * If the username already exists it's promoted to admin and its password reset.
 * Bun auto-loads .env.local for DATABASE_URL.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { hashPassword } from "../lib/auth/password";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}

const [, , rawUsername, password] = process.argv;
const username = rawUsername?.trim().toLowerCase();

if (!username || !password) {
  console.error("Usage: bun run create-admin <username> <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const db = drizzle(neon(process.env.DATABASE_URL), { schema });
const passwordHash = await hashPassword(password);

const [user] = await db
  .insert(schema.users)
  .values({ username, passwordHash, role: "admin" })
  .onConflictDoUpdate({
    target: schema.users.username,
    set: { passwordHash, role: "admin" },
  })
  .returning({ id: schema.users.id, username: schema.users.username, role: schema.users.role });

console.log(`✓ admin ready: ${user.username} (id ${user.id}, role ${user.role})`);
process.exit(0);
