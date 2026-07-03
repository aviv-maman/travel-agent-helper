/**
 * Deletes expired sessions and stale login-attempt rows so those tables don't
 * grow unbounded. Safe to run any time; schedule it (e.g. a daily cron on your
 * infra, or from the Python backend). Bun auto-loads .env.local.
 *
 *   bun run cleanup
 */
import { and, isNull, lt, or } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}

const db = drizzle(neon(process.env.DATABASE_URL), { schema });
const now = new Date();
const staleBefore = new Date(now.getTime() - 60 * 60 * 1000); // attempt rows older than 1h

const expiredSessions = await db
  .delete(schema.sessions)
  .where(lt(schema.sessions.expiresAt, now))
  .returning({ id: schema.sessions.id });

// Remove attempt rows that are neither locked nor inside an active window.
const staleAttempts = await db
  .delete(schema.loginAttempts)
  .where(
    and(
      or(isNull(schema.loginAttempts.lockedUntil), lt(schema.loginAttempts.lockedUntil, now)),
      lt(schema.loginAttempts.windowStartsAt, staleBefore),
    ),
  )
  .returning({ key: schema.loginAttempts.key });

console.log(
  `✓ removed ${expiredSessions.length} expired session(s), ${staleAttempts.length} stale attempt row(s)`,
);
process.exit(0);
