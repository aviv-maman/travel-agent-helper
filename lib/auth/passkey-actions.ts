"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";
import { THEME_COOKIE, THEME_MAX_AGE, isTheme } from "@/lib/theme";
import { getCurrentUser } from ".";
import { createSession } from "./session";
import { recordAudit } from "./audit";
import { safeNext } from "./protected-routes";
import {
  registrationOptions,
  verifyRegistration,
  authenticationOptions,
  verifyAuthentication,
  deleteUserPasskey,
} from "./passkeys";

/**
 * Server actions for passkeys (WebAuthn). Each ceremony is two actions: an
 * "options" half (generates + stores the challenge) and a "verify" half. The
 * cryptographic verification lives in lib/auth/passkeys.ts; sessions stay our
 * custom DB sessions. Passkey sign-in creates a FULLY authenticated session —
 * no TOTP step — because a passkey is itself phishing-resistant MFA.
 */

// ── Add a passkey (signed-in users, from Account → Security) ─────────────────

export async function passkeyRegistrationOptions() {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" as const };
  return { options: await registrationOptions(user) };
}

export async function passkeyRegistrationVerify(
  response: RegistrationResponseJSON,
): Promise<{ ok?: boolean; error?: "forbidden" | "failed" }> {
  const user = await getCurrentUser();
  if (!user) return { error: "forbidden" };
  const ok = await verifyRegistration(user, response).catch(() => false);
  if (!ok) return { error: "failed" };
  await recordAudit("passkey.add", { actorId: user.id });
  revalidatePath("/[locale]/account/security", "page");
  return { ok: true };
}

/** Remove one of the caller's own passkeys. */
export async function deletePasskeyAction(credentialId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await deleteUserPasskey(user.id, credentialId);
  await recordAudit("passkey.remove", { actorId: user.id });
  revalidatePath("/[locale]/account/security", "page");
}

// ── One-click sign-in (login page; no user context yet) ──────────────────────

export async function passkeyLoginOptions() {
  return { options: await authenticationOptions() };
}

/** Verify the assertion and sign the user in. Redirects on success. */
export async function passkeyLogin(
  locale: string,
  next: string,
  response: AuthenticationResponseJSON,
): Promise<{ error: "failed" } | never> {
  const user = await verifyAuthentication(response).catch(() => null);
  if (!user) return { error: "failed" };

  await createSession(user); // fully authenticated — passkey satisfies MFA
  await recordAudit("login", { actorId: user.id, meta: { method: "passkey" } });
  if (user.themePref && isTheme(user.themePref)) {
    (await cookies()).set(THEME_COOKIE, user.themePref, {
      path: "/",
      maxAge: THEME_MAX_AGE,
      sameSite: "lax",
    });
  }
  redirect(safeNext(next, locale));
}
