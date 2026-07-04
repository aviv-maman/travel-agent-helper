import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { routing } from "@/i18n/routing";
import { isProtectedPath } from "@/lib/auth/protected-routes";
import { USER_COOKIE } from "@/lib/auth/public-user";

const handleI18n = createMiddleware(routing);
const locales = routing.locales as readonly string[];

/**
 * SHA-256 → hex using Web Crypto (edge-safe). Mirrors the `node:crypto` hashing in
 * session.ts so the same token yields the same session-row id here as on the server.
 */
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Whether the raw session token maps to a live, fully-authenticated session row.
 * (A deleted user cascade-deletes their sessions, so a surviving row implies a
 * real user — no join needed. Mirrors `validateSession`, minus the last-seen bump.)
 */
async function sessionIsValid(token: string): Promise<boolean> {
  const [row] = await db
    .select({ expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(and(eq(sessions.id, await hashToken(token)), eq(sessions.mfaPending, false)))
    .limit(1);
  return Boolean(row) && row.expiresAt.getTime() >= Date.now();
}

/**
 * First-pass auth gate composed with next-intl routing. Unlike a presence check, it
 * looks the `session` token up in the DB, because a token can outlive its row — the
 * DB was reseeded in dev, or the session was revoked from another device — leaving
 * the client-readable `session_user` nav mirror showing a signed-in user the server
 * rejects. So when the session isn't valid we (a) redirect protected pages to /login
 * and (b) clear BOTH cookies, keeping the client's view in sync with the server's.
 *
 * Still NOT the whole security boundary: it validates the session but not per-route
 * permissions/roles — the server DAL (requireUser / can / …) remains authoritative on
 * render. The `session` cookie is httpOnly, readable here though not in client JS.
 */
export default async function proxy(req: NextRequest): Promise<NextResponse> {
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const hasLocale = segments.length > 0 && locales.includes(segments[0]);
  const locale = hasLocale ? segments[0] : routing.defaultLocale;
  const appPath = `/${(hasLocale ? segments.slice(1) : segments).join("/")}`;

  // Only hit the DB when a session cookie is actually present (anonymous users don't).
  const token = req.cookies.get("session")?.value;
  const loggedIn = token ? await sessionIsValid(token) : false;

  if (isProtectedPath(appPath) && !loggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = "";
    url.searchParams.set("next", req.nextUrl.pathname);
    return clearStaleCookies(NextResponse.redirect(url), req, loggedIn);
  }

  return clearStaleCookies(handleI18n(req), req, loggedIn);
}

/** Drop orphaned auth cookies (session + nav mirror) whenever the session isn't valid. */
function clearStaleCookies(res: NextResponse, req: NextRequest, loggedIn: boolean): NextResponse {
  if (!loggedIn && (req.cookies.get("session") || req.cookies.get(USER_COOKIE))) {
    res.cookies.delete("session");
    res.cookies.delete(USER_COOKIE);
  }
  return res;
}

export const config = {
  // Match all paths except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
