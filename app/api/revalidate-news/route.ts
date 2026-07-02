import { revalidateTag } from "next/cache";
import { NEWS_TAG } from "@/lib/news";

/**
 * On-demand refresh of the news feed. Purges every `NEWS_TAG`-tagged fetch (and
 * the /news route cache), so the next visitor gets a freshly-fetched feed
 * instead of waiting out the 30-minute window.
 *
 *   curl -X POST "https://<host>/api/revalidate-news?secret=<NEWS_REVALIDATE_SECRET>"
 *
 * Set NEWS_REVALIDATE_SECRET in the environment; without it the endpoint is
 * disabled so it can't be triggered anonymously.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.NEWS_REVALIDATE_SECRET;
  const provided = new URL(request.url).searchParams.get("secret");
  if (!secret || provided !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  // Second arg is the stale-while-revalidate window; "max" serves stale content
  // while the fresh feed regenerates in the background (Next 16 recommendation).
  revalidateTag(NEWS_TAG, "max");
  return Response.json({ ok: true, revalidated: NEWS_TAG, now: new Date().toISOString() });
}
