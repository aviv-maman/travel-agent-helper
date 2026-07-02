import { setRequestLocale } from "next-intl/server";
import { getNews, getNewsSources } from "@/lib/news";
import { NewsList } from "@/components/news/news-list";
import { RefreshNewsButton } from "@/components/news/refresh-news-button";

// Revalidate the aggregated feed in the background; individual source fetches
// set their own revalidation window in lib/news.ts.
export const revalidate = 1800;

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [articles, sources] = [await getNews(locale), getNewsSources(locale)];

  return (
    <div className="flex flex-col gap-4">
      {/* Renders only for users with the news:revalidate permission (client-gated
          so this page stays statically rendered). */}
      <div className="flex justify-end empty:hidden">
        <RefreshNewsButton />
      </div>
      <NewsList articles={articles} sources={sources} />
    </div>
  );
}
