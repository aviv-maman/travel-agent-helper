import { setRequestLocale } from "next-intl/server";
import { getNews, getNewsSources } from "@/lib/news";
import { can } from "@/lib/auth";
import { NewsList } from "@/components/news/news-list";
import { RefreshNewsButton } from "@/components/news/refresh-news-button";

// Auth-gated refresh means we read the session, so this route renders per
// request. The expensive source fetches stay cached (30 min) in lib/news.ts, so
// per-request work is just rendering already-cached data.
export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [articles, sources, canRefresh] = [
    await getNews(locale),
    getNewsSources(locale),
    await can("news:revalidate"),
  ];

  return (
    <div className="flex flex-col gap-4">
      {canRefresh && (
        <div className="flex justify-end">
          <RefreshNewsButton />
        </div>
      )}
      <NewsList articles={articles} sources={sources} />
    </div>
  );
}
