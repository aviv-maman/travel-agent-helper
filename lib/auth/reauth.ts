import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const REAUTH_TTL_SECONDS = 5 * 60; // 5 minutes

/**
 * Check if the current session has valid reauth credentials (password/TOTP verified in the last 5 min).
 * Used to gate sensitive operations (passkey registration, account deletion, etc.).
 * Note: In a full implementation, this should be called from a server action that has cookies access.
 */
export async function hasValidReauth(): Promise<boolean> {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) return false;

    const session = await db
      .select({ reauthExpiresAt: sessions.reauthExpiresAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!session || !session.reauthExpiresAt) return false;

    return new Date() < session.reauthExpiresAt;
  } catch {
    return false;
  }
}

/**
 * Mark the current session with valid reauth credentials for 5 minutes.
 * Call this after verifying password/TOTP.
 *
 * TODO: Wire this to server actions that verify password/TOTP and call this on success.
 * Example: reauthWithPassword() and reauthWithTotp() server actions.
 */
export async function markReauthValid(): Promise<boolean> {
  try {
    const sessionId = await getSessionId();
    if (!sessionId) return false;

    const expiresAt = new Date(Date.now() + REAUTH_TTL_SECONDS * 1000);
    await db.update(sessions).set({ reauthExpiresAt: expiresAt }).where(eq(sessions.id, sessionId));
    return true;
  } catch {
    return false;
  }
}

// Helper: get session ID from cookies
async function getSessionId(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get("session")?.value ?? null;
  } catch {
    return null;
  }
}
