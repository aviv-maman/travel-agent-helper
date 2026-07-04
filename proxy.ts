import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { isProtectedPath } from "@/lib/auth/protected-routes";

const handleI18n = createMiddleware(routing);
const locales = routing.locales as readonly string[];

/**
 * Optimistic auth gate composed with next-intl routing. If a request targets a
 * protected page prefix and carries no `session` cookie, bounce to /login with a
 * `next` param; otherwise hand off to next-intl. This is a UX shortcut, not the
 * security boundary — the server DAL (requireUser/…) still enforces auth on render.
 * The `session` cookie is httpOnly, which is readable here (middleware) though not
 * in client JS.
 */
export default function proxy(req: NextRequest): NextResponse {
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const hasLocale = segments.length > 0 && locales.includes(segments[0]);
  const locale = hasLocale ? segments[0] : routing.defaultLocale;
  const appPath = `/${(hasLocale ? segments.slice(1) : segments).join("/")}`;

  if (isProtectedPath(appPath) && !req.cookies.get("session")) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = "";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return handleI18n(req);
}

export const config = {
  // Match all paths except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
