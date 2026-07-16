import "server-only";
import { getCurrentUser } from ".";
import { verifyPassword } from "./password";
import { decryptTotpSecret } from "./crypto";
import { verifyTotpWithReplayProtection } from "./totp";
import { markReauthValid } from "./reauth";

export type ReauthState = { ok?: boolean; error?: string };

/** Verify password and grant 5-minute reauth access. */
export async function reauthWithPassword(
  _prev: ReauthState,
  formData: FormData,
): Promise<ReauthState> {
  const user = await getCurrentUser();
  if (!user) return { error: "not_authenticated" };

  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "missing" };

  if (!user.passwordHash) {
    return { error: "no_password" };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return { error: "invalid_password" };

  // Grant reauth access for 5 minutes
  await markReauthValid();
  return { ok: true };
}

/** Verify TOTP and grant 5-minute reauth access. */
export async function reauthWithTotp(
  _prev: ReauthState,
  formData: FormData,
): Promise<ReauthState> {
  const user = await getCurrentUser();
  if (!user) return { error: "not_authenticated" };

  if (!user.totpEnabledAt || !user.totpSecret) {
    return { error: "2fa_not_enabled" };
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "missing" };

  // Decrypt and verify TOTP with replay protection
  try {
    const decrypted = decryptTotpSecret(user.totpSecret);
    const { valid } = verifyTotpWithReplayProtection(
      decrypted,
      code,
      user.totpLastUsedStep,
    );

    if (!valid) return { error: "invalid_code" };
  } catch {
    return { error: "invalid_code" };
  }

  // Grant reauth access for 5 minutes
  await markReauthValid();
  return { ok: true };
}
