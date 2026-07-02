import { setRequestLocale } from "next-intl/server";
import { getNews, getNewsSources } from "@/lib/news";
import { NewsList } from "@/components/news/news-list";

// Revalidate the aggregated feed in the background; individual source fetches
// set their own revalidation window in lib/news.ts.
export const revalidate = 1800;

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [articles, sources] = [await getNews(locale), getNewsSources(locale)];

  return <NewsList articles={articles} sources={sources} />;
}
