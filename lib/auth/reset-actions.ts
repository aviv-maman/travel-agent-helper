"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, backupCodes } from "@/db/schema";
import { getCurrentUser } from ".";
import { hashPassword } from "./password";
import { verifyTotp, hashBackupCode } from "./totp";
import { invalidateUserSessions } from "./session";
import { recordAudit } from "./audit";
import { clientIp, isLocked, recordFailure } from "./rate-limit";
import { createEmailToken, consumeEmailToken, invalidateEmailTokens } from "./email-tokens";
import { sendTemplateEmail, requestOrigin } from "@/lib/email";

/**
 * Password reset + email verification (docs/password-reset-contract.md). All the
 * token/DB logic lives here; the backend only *sends* the email. Until Resend is
 * wired the send is a no-op (503) and these flows degrade to a neutral message.
 */

export type ResetState = { ok?: boolean; error?: string };

// --- Forgot password (request a reset link) ---------------------------------

export async function requestPasswordReset(
  locale: string,
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "missing" };

  // NEVER reveal whether the address exists — always the same neutral response.
  const neutral: ResetState = { ok: true };

  const ip = await clientIp();
  const key = `pwreset:${ip}`;
  if (await isLocked(key)) return neutral;
  await recordFailure(key); // throttle abuse per IP

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Only real, verified, password-capable accounts get a link (OAuth-only users
  // have no password; unverified addresses can't receive reset mail).
  if (user?.emailVerifiedAt && user.passwordHash) {
    const token = await createEmailToken(user.id, "reset");
    const url = `${await requestOrigin()}/${locale}/reset?token=${token}`;
    await sendTemplateEmail(email, "password_reset", locale, { url, expiresMinutes: 45 });
  }
  return neutral;
}

// --- Reset (set a new password from a link) ---------------------------------

export async function resetPassword(
  locale: string,
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (next.length < 8) return { error: "passwordShort" };
  if (next !== confirm) return { error: "passwordMismatch" };

  const userId = await consumeEmailToken(token, "reset");
  if (!userId) return { error: "invalidToken" };
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { error: "invalidToken" };

  // Email possession must NOT bypass a second factor.
  if (user.totpEnabledAt && user.totpSecret) {
    let ok = verifyTotp(user.totpSecret, code);
    if (!ok && code) {
      const [backup] = await db
        .select({ id: backupCodes.id })
        .from(backupCodes)
        .where(
          and(
            eq(backupCodes.userId, user.id),
            eq(backupCodes.codeHash, hashBackupCode(code)),
            isNull(backupCodes.usedAt),
          ),
        )
        .limit(1);
      if (backup) {
        await db
          .update(backupCodes)
          .set({ usedAt: new Date() })
          .where(eq(backupCodes.id, backup.id));
        ok = true;
      }
    }
    if (!ok) return { error: "invalidCode" };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, user.id));
  await invalidateUserSessions(user.id); // sign out everywhere
  await invalidateEmailTokens(user.id, "reset"); // burn any other outstanding links
  await recordAudit("password.reset", { actorId: user.id });
  redirect(`/${locale}/login?reset=1`);
}

// --- Email verification -----------------------------------------------------

/** Send (or resend) a verification link to the signed-in user's email. */
export async function sendVerificationEmail(locale: string): Promise<ResetState> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };
  if (!user.email) return { error: "noEmail" };
  if (user.emailVerifiedAt) return { ok: true };
  const token = await createEmailToken(user.id, "verify");
  const url = `${await requestOrigin()}/${locale}/verify?token=${token}`;
  await sendTemplateEmail(user.email, "email_verification", locale, { url });
  return { ok: true };
}

/** Confirm a verify token (called from the /verify page). */
export async function confirmEmailVerification(token: string): Promise<boolean> {
  const userId = await consumeEmailToken(token, "verify");
  if (!userId) return false;
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  await recordAudit("email.verify", { actorId: userId });
  return true;
}
