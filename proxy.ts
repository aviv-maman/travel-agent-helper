import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { routing } from "@/i18n/routing";
import { isProtectedPath } from "@/lib/auth/protected-routes";
import { SESSION_COOKIE, USER_COOKIE, SESSION_VERIFIED_COOKIE } from "@/lib/auth/cookies";

const handleI18n = createMiddleware(routing);
const locales = routing.locales as readonly string[];

/**
 * How long a DB validation is trusted before we check again. A *fixed* (non-sliding)
 * lifetime for the `session_verified` marker, so even a continuously-active user
 * re-validates at least this often — bounding how long a revoked/expired session's
 * nav name can linger to this window.
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
 * Classify the raw session token against its DB row:
 *   - "valid"   → a live, fully-authenticated session (grants access);
 *   - "pending" → a live session still in the 2FA code step (no access yet, but
 *                 its cookie MUST survive so `verifyMfa` can read it);
 *   - "none"    → no row, expired, or otherwise dead → safe to clear the cookies.
 *
 * (A deleted user cascade-deletes their sessions, so a surviving row implies a
 * real user — no join needed. Mirrors `validateSession`, minus the last-seen bump.)
 */
async function sessionState(token: string): Promise<"valid" | "pending" | "none"> {
  const [row] = await db
    .select({ expiresAt: sessions.expiresAt, mfaPending: sessions.mfaPending })
    .from(sessions)
    .where(eq(sessions.id, await hashToken(token)))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return "none";
  return row.mfaPending ? "pending" : "valid";
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
 * SESSION_VERIFIED_COOKIE / RECHECK_TTL_SECONDS).
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
  const trusted = Boolean(req.cookies.get(SESSION_VERIFIED_COOKIE));
  let didDbCheck = false;
  // "pending" (mid-2FA) sessions are never marked trusted, so they always hit the
  // DB check below and are classified correctly — never mistaken for "none".
  let state: "valid" | "pending" | "none" = "none";
  if (token) {
    if (trusted) {
      state = "valid";
    } else {
      state = await sessionState(token);
      didDbCheck = true;
    }
  }
  const loggedIn = state === "valid";

  if (isProtectedPath(appPath) && !loggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = "";
    url.searchParams.set("next", req.nextUrl.pathname);
    return syncAuthCookies(NextResponse.redirect(url), req, state, didDbCheck);
  }

  return syncAuthCookies(handleI18n(req), req, state, didDbCheck);
}

/**
 * Reconcile the auth cookies with what we just determined:
 *   - dead session ("none") → drop `session`, the `session_user` nav mirror, and the marker;
 *   - pending session (mid-2FA) → leave cookies untouched so `verifyMfa` can still read
 *     the `session` token to finish signing in;
 *   - freshly DB-validated → (re)issue the short-lived `session_verified` marker.
 */
function syncAuthCookies(
  res: NextResponse,
  req: NextRequest,
  state: "valid" | "pending" | "none",
  didDbCheck: boolean,
): NextResponse {
  if (state === "none") {
    if (
      req.cookies.get(SESSION_COOKIE) ||
      req.cookies.get(USER_COOKIE) ||
      req.cookies.get(SESSION_VERIFIED_COOKIE)
    ) {
      res.cookies.delete(SESSION_COOKIE);
      res.cookies.delete(USER_COOKIE);
      res.cookies.delete(SESSION_VERIFIED_COOKIE);
    }
  } else if (state === "valid" && didDbCheck) {
    res.cookies.set(SESSION_VERIFIED_COOKIE, "1", {
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
