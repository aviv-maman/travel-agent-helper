import { redirect } from "next/navigation";

/**
 * The news feed moved into the dashboard's News tab (2026-07) — this route
 * survives only so old bookmarks land somewhere sensible. The dashboard is
 * login-gated, so anonymous visitors bounce to /login from there.
 */
export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
