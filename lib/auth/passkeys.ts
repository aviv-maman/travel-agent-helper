import "server-only";
import { cookies, headers } from "next/headers";
import { and, eq, desc } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "@/db";
import { passkeys, users, type User } from "@/db/schema";

/**
 * WebAuthn (passkeys) ceremony layer. @simplewebauthn verifies the
 * cryptographic ceremonies only — sessions, cookies, and everything else stay
 * in our custom auth (lib/auth/session.ts). The private key never leaves the
 * user's authenticator; we store the public key + a signature counter.
 *
 * Challenges are one-shot values kept in a short-lived httpOnly cookie between
 * the "options" and "verify" halves of each ceremony.
 */

const CHALLENGE_COOKIE = "webauthn_challenge";
const CHALLENGE_TTL_SECONDS = 5 * 60;
const RP_NAME = "Travel Agent Helper";

/** Relying-party id + expected origin, derived from the request host so the
 * same code works on localhost and on the deployed domain. */
async function rp(): Promise<{ rpID: string; origin: string }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return { rpID: host.split(":")[0], origin: `${proto}://${host}` };
}

async function setChallenge(challenge: string): Promise<void> {
  (await cookies()).set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

/** Read the pending challenge and clear it — each challenge is single-use. */
async function takeChallenge(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CHALLENGE_COOKIE)?.value ?? null;
  store.delete(CHALLENGE_COOKIE);
  return value;
}

/** A short device label from the registering browser's user-agent. */
async function deviceLabel(): Promise<string> {
  const ua = (await headers()).get("user-agent") ?? "";
  if (/iPhone|iPad/i.test(ua)) return "iPhone/iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  return "Passkey";
}

// ── Registration (add a passkey; user already signed in) ─────────────────────

export async function registrationOptions(user: { id: number; username: string }) {
  const { rpID } = await rp();
  const existing = await db
    .select({ id: passkeys.id, transports: passkeys.transports })
    .from(passkeys)
    .where(eq(passkeys.userId, user.id));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.username,
    userID: new TextEncoder().encode(String(user.id)),
    attestationType: "none",
    // Don't re-register an authenticator that already holds a passkey here.
    excludeCredentials: existing.map((c) => ({
      id: c.id,
      transports: parseTransports(c.transports),
    })),
    authenticatorSelection: {
      residentKey: "required", // discoverable → enables the one-click login
      userVerification: "preferred",
    },
  });
  await setChallenge(options.challenge);
  return options;
}

export async function verifyRegistration(
  user: { id: number },
  response: RegistrationResponseJSON,
): Promise<boolean> {
  const challenge = await takeChallenge();
  if (!challenge) return false;
  const { rpID, origin } = await rp();

  const { verified, registrationInfo } = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });
  if (!verified || !registrationInfo) return false;

  const { credential } = registrationInfo;
  await db.insert(passkeys).values({
    id: credential.id,
    userId: user.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports ? JSON.stringify(credential.transports) : null,
    deviceName: await deviceLabel(),
  });
  return true;
}

// ── Authentication (one-click sign-in; no user context yet) ──────────────────

export async function authenticationOptions() {
  const { rpID } = await rp();
  // No allowCredentials → discoverable credentials: the browser/OS shows the
  // user their available passkeys for this site.
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
  await setChallenge(options.challenge);
  return options;
}

/** Verify an assertion; on success bump the counter and return the user. */
export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
): Promise<User | null> {
  const challenge = await takeChallenge();
  if (!challenge) return null;
  const { rpID, origin } = await rp();

  const [row] = await db
    .select({ passkey: passkeys, user: users })
    .from(passkeys)
    .innerJoin(users, eq(passkeys.userId, users.id))
    .where(eq(passkeys.id, response.id))
    .limit(1);
  if (!row) return null;

  const { verified, authenticationInfo } = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: row.passkey.id,
      publicKey: new Uint8Array(Buffer.from(row.passkey.publicKey, "base64url")),
      counter: row.passkey.counter,
      transports: parseTransports(row.passkey.transports),
    },
  });
  if (!verified) return null;

  await db
    .update(passkeys)
    .set({ counter: authenticationInfo.newCounter, lastUsedAt: new Date() })
    .where(eq(passkeys.id, row.passkey.id));
  return row.user;
}

// ── Management ────────────────────────────────────────────────────────────────

export async function listPasskeys(userId: number) {
  return db
    .select({
      id: passkeys.id,
      deviceName: passkeys.deviceName,
      createdAt: passkeys.createdAt,
      lastUsedAt: passkeys.lastUsedAt,
    })
    .from(passkeys)
    .where(eq(passkeys.userId, userId))
    .orderBy(desc(passkeys.createdAt));
}

/** Delete one of the OWNER's passkeys (ownership enforced in the query). */
export async function deleteUserPasskey(userId: number, credentialId: string): Promise<void> {
  await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, credentialId), eq(passkeys.userId, userId)));
}

function parseTransports(json: string | null): AuthenticatorTransport[] | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as AuthenticatorTransport[];
  } catch {
    return undefined;
  }
}
