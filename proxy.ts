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

const SESSION_COOKIE = "session";
/**
 * Presence-only marker: set for `RECHECK_TTL_SECONDS` after a successful DB
 * validation. While it's alive the middleware trusts the session without another
 * DB round-trip. It carries no data — forging it can't grant access (the session
 * token is still the secret, and the server DAL re-checks the DB on every protected
 * render), it only controls how *often* we re-validate.
 */
const VERIFIED_COOKIE = "session_verified";
/**
 * How long a DB validation is trusted before we check again. A *fixed* (non-sliding)
 * lifetime, so even a continuously-active user re-validates at least this often —
 * bounding how long a revoked/expired session's nav name can linger to this window.
 */
const RECHECK_TTL_SECONDS = 60;

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
 * confirms the `session` token is really live, because a token can outlive its row —
 * the DB was reseeded in dev, or the session was revoked from another device —
 * leaving the client-readable `session_user` nav mirror showing a signed-in user the
 * server rejects. So when the session isn't valid we (a) redirect protected pages to
 * /login and (b) clear the auth cookies, keeping the client's view in sync with the
 * server's.
 *
 * To avoid a DB read on every logged-in navigation, a successful check drops a
 * short-lived `session_verified` cookie; while it's present we skip the lookup (see
 * VERIFIED_COOKIE / RECHECK_TTL_SECONDS).
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

  // No session cookie → anonymous, no DB hit. Recently verified → trust the marker.
  // Otherwise validate against the DB (and remember the result via the marker below).
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const trusted = Boolean(req.cookies.get(VERIFIED_COOKIE));
  let didDbCheck = false;
  let loggedIn = false;
  if (token) {
    if (trusted) {
      loggedIn = true;
    } else {
      loggedIn = await sessionIsValid(token);
      didDbCheck = true;
    }
  }

  if (isProtectedPath(appPath) && !loggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = "";
    url.searchParams.set("next", req.nextUrl.pathname);
    return syncAuthCookies(NextResponse.redirect(url), req, loggedIn, didDbCheck);
  }

  return syncAuthCookies(handleI18n(req), req, loggedIn, didDbCheck);
}

/**
 * Reconcile the auth cookies with what we just determined:
 *   - invalid session → drop `session`, the `session_user` nav mirror, and the marker;
 *   - freshly DB-validated → (re)issue the short-lived `session_verified` marker.
 */
function syncAuthCookies(
  res: NextResponse,
  req: NextRequest,
  loggedIn: boolean,
  didDbCheck: boolean,
): NextResponse {
  if (!loggedIn) {
    if (req.cookies.get(SESSION_COOKIE) || req.cookies.get(USER_COOKIE) || req.cookies.get(VERIFIED_COOKIE)) {
      res.cookies.delete(SESSION_COOKIE);
      res.cookies.delete(USER_COOKIE);
      res.cookies.delete(VERIFIED_COOKIE);
    }
  } else if (didDbCheck) {
    res.cookies.set(VERIFIED_COOKIE, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: RECHECK_TTL_SECONDS,
    });
  }
  return res;
}

export const config = {
  // Match all paths except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
