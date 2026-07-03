import "server-only";
import * as cheerio from "cheerio";
import type { Locale } from "@/i18n/config";

/**
 * Tourism news aggregator. Pulls travel articles from a handful of external
 * publishers (RSS feeds where available, HTML/JSON-LD scraping otherwise),
 * per display language, and merges them into one date-sorted list.
 *
 * These sites offer no official API, so scraped selectors are inherently
 * fragile — every source is wrapped in try/catch and a failed source is simply
 * skipped rather than breaking the page. We deliberately keep only the title,
 * a short excerpt and a link back to the original article (no full text) to
 * stay on the right side of the publishers' copyright.
 */

export type NewsArticle = {
  /** Stable de-dupe key — the canonical article URL. */
  url: string;
  title: string;
  /** Short plain-text snippet; empty when the source exposes none. */
  excerpt: string;
  /** Absolute image URL, or null when the source exposes none. */
  image: string | null;
  /** ISO timestamp, or null when the source exposes no date. */
  publishedAt: string | null;
  /** Source id (used for the filter chips) and display name. */
  sourceId: string;
  sourceName: string;
};

type NewsSource = {
  id: string;
  name: string;
  /** The listing/feed URL we fetch. */
  url: string;
  /** Origin used to resolve relative links found while scraping. */
  base: string;
  parse: (_body: string, _src: NewsSource) => NewsArticle[];
  /** RSS only: keep items whose link contains this path fragment. */
  filterPath?: string;
  /**
   * Fetch each article page to pull its `og:image` when the listing/feed exposes
   * no thumbnail (israelhayom). Costs one extra request per image-less article,
   * so enable it only for small feeds.
   */
  hydrateImages?: boolean;
};

const MAX_PER_SOURCE = 12;
const FETCH_TIMEOUT_MS = 15_000;
const REVALIDATE_SECONDS = 1_800; // 30 min

/** Cache tag on every news fetch — `revalidateTag(NEWS_TAG)` forces a full refresh. */
export const NEWS_TAG = "news";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "he,en;q=0.9",
};

// ── Shared helpers ───────────────────────────────────────────────────────────

/** Collapse whitespace and hard-truncate to a card-friendly excerpt. */
function toExcerpt(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

/** Parse a feed date into an ISO string, or null when unparseable. */
function toIso(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Resolve a possibly-relative href against a source origin. */
function absolute(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/**
 * Turn a scraped <img> src into a directly-usable absolute URL. Handles two
 * cases that would otherwise render broken on our domain:
 *  - Next.js optimizer paths ("/_next/image?url=<encoded original>&w=…") — we
 *    decode and use the original image (c14news).
 *  - relative paths — resolved against the source origin.
 * Returns null for empty/data-URI placeholders.
 */
function normalizeImage(src: string | undefined, base: string): string | null {
  if (!src || src.startsWith("data:")) return null;
  const optimized = src.match(/_next\/image\?(?:.*?&)?url=([^&"]+)/);
  if (optimized) {
    try {
      src = decodeURIComponent(optimized[1]);
    } catch {
      /* keep original src */
    }
  }
  return absolute(src, base);
}

/**
 * Build a readable headline from a URL slug — a fallback for sources (e.g.
 * Travel + Leisure) that list article URLs without a title. Drops the trailing
 * numeric id and sentence-cases the slug: ".../bat-contact-12009801" → "Bat
 * contact". Returns "" when the slug is too short to be a real title.
 */
function titleFromUrl(url: string): string {
  let slug: string;
  try {
    slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  } catch {
    return "";
  }
  const words = slug.replace(/-\d+$/, "").split("-").filter(Boolean);
  if (words.length < 3) return "";
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Host-independent key for matching an article across www/non-www URL forms. */
function pathOf(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/**
 * Map article pathname → ISO date from a page's JSON-LD `NewsArticle` blocks
 * (Channel 14 embeds one per listed article). Keyed by pathname so www vs
 * non-www URL forms still match.
 */
function jsonLdDateMap(body: string): Map<string, string> {
  const $ = cheerio.load(body);
  const map = new Map<string, string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const rawUrl =
      typeof o.url === "string"
        ? o.url
        : typeof o.mainEntityOfPage === "string"
          ? o.mainEntityOfPage
          : "";
    const date = typeof o.datePublished === "string" ? toIso(o.datePublished) : null;
    const key = rawUrl && pathOf(rawUrl);
    if (key && date) map.set(key, date);
    for (const v of Object.values(o)) visit(v);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.includes("datePublished")) return;
    try {
      visit(JSON.parse(raw));
    } catch {
      /* malformed block — skip */
    }
  });
  return map;
}

// ── RSS ──────────────────────────────────────────────────────────────────────

/** Pull the first available image URL out of a single RSS <item> block. */
function rssImage(itemXml: string): string | null {
  const media =
    itemXml.match(/<media:(?:thumbnail|content)[^>]*\surl="([^"]+)"/i) ??
    itemXml.match(/<enclosure[^>]*\surl="([^"]+)"/i);
  if (media) return media[1];
  // Some feeds put the thumbnail in a per-item <image> tag (mako).
  const tag = itemXml.match(/<image>\s*(https?:\/\/[^<\s]+)\s*<\/image>/i);
  if (tag) return tag[1];
  // Others embed an <img> in the (CDATA) description; the quotes may be single (ynet).
  const img = itemXml.match(/<img[^>]*\ssrc=['"]([^'"]+)['"]/i);
  return img ? img[1] : null;
}

function parseRss(body: string, src: NewsSource): NewsArticle[] {
  const $ = cheerio.load(body, { xmlMode: true });
  const out: NewsArticle[] = [];
  $("item").each((_, el) => {
    const $el = $(el);
    const title = $el.find("title").first().text().trim();
    const link = $el.find("link").first().text().trim() || $el.find("guid").first().text().trim();
    if (!title || !link) return;
    if (src.filterPath && !link.includes(src.filterPath)) return;
    const descHtml = $el.find("description").first().text();
    const excerpt = toExcerpt(cheerio.load(`<div>${descHtml}</div>`).text());
    out.push({
      url: link,
      title,
      excerpt,
      image: rssImage($.html(el)),
      publishedAt: toIso($el.find("pubDate").first().text()),
      sourceId: src.id,
      sourceName: src.name,
    });
  });
  return out;
}

// ── JSON-LD ItemList (JPost) ─────────────────────────────────────────────────

type LdNode = { "@type"?: string | string[]; [key: string]: unknown };

/**
 * Map article pathname → ISO date from any `<time datetime>` cards on the page.
 * JPost's ItemList carries no dates, but its featured cards do; this recovers
 * dates for those (compact list rows stay date-less).
 */
function timeTagDateMap($: cheerio.CheerioAPI, base: string): Map<string, string> {
  const map = new Map<string, string>();
  $("time[datetime]").each((_, el) => {
    const date = toIso($(el).attr("datetime"));
    if (!date) return;
    // Climb to the card container that also holds the article link.
    let node = $(el).parent();
    for (let i = 0; i < 6 && node.length; i++) {
      const href = node.find('a[href*="article-"]').first().attr("href");
      if (href) {
        const key = pathOf(absolute(href, base) ?? "");
        if (key) map.set(key, date);
        break;
      }
      node = node.parent();
    }
  });
  return map;
}

/**
 * Map article pathname → thumbnail from a page's `<img>` cards, associating each
 * image with the nearest article link in its container. JPost's ItemList carries
 * no images, but its cards do; the site logo is skipped.
 */
function cardImageMap($: cheerio.CheerioAPI, base: string): Map<string, string> {
  const map = new Map<string, string>();
  $("img").each((_, el) => {
    const raw = $(el).attr("src");
    if (!raw || /logo/i.test(raw)) return;
    const img = normalizeImage(raw, base);
    if (!img) return;
    let node = $(el).parent();
    for (let i = 0; i < 6 && node.length; i++) {
      const href = node.find('a[href*="article-"]').first().attr("href");
      if (href) {
        const key = pathOf(absolute(href, base) ?? "");
        if (key && !map.has(key)) map.set(key, img);
        break;
      }
      node = node.parent();
    }
  });
  return map;
}

function parseItemList(body: string, src: NewsSource): NewsArticle[] {
  const $ = cheerio.load(body);
  const out: NewsArticle[] = [];
  const seen = new Set<string>();
  const dates = timeTagDateMap($, src.base);
  const cardImages = cardImageMap($, src.base);

  const collect = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as LdNode;
    const type = obj["@type"];
    const isList = Array.isArray(type) ? type.includes("ItemList") : type === "ItemList";
    if (isList && Array.isArray(obj.itemListElement)) {
      for (const el of obj.itemListElement as LdNode[]) {
        const rawUrl = typeof el.url === "string" ? el.url : "";
        const url = rawUrl && absolute(rawUrl, src.base);
        if (!url || seen.has(url)) continue;
        // Prefer the schema's title; fall back to the slug when absent (T+L).
        const name = (typeof el.name === "string" && el.name.trim()) || titleFromUrl(url);
        if (!name) continue;
        seen.add(url);
        const path = pathOf(url);
        const ldImage = typeof el.image === "string" ? el.image : null;
        out.push({
          url,
          title: name,
          excerpt: "",
          image: ldImage ?? (path ? (cardImages.get(path) ?? null) : null),
          publishedAt: (path && dates.get(path)) || null,
          sourceId: src.id,
          sourceName: src.name,
        });
      }
    }
    for (const value of Object.values(obj)) collect(value);
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.includes("ItemList")) return;
    try {
      collect(JSON.parse(raw));
    } catch {
      /* malformed JSON-LD block — skip */
    }
  });
  return out;
}

// ── HTML scrapers ────────────────────────────────────────────────────────────

/**
 * Channel 14 travel archive (Hebrew c14.co.il and English c14news.com share the
 * same engine): each card is an <a href="/article/ID"> wrapping the story.
 */
function scrapeC14(body: string, src: NewsSource): NewsArticle[] {
  const $ = cheerio.load(body);
  const out: NewsArticle[] = [];
  const seen = new Set<string>();
  const dates = jsonLdDateMap(body); // per-article publish dates, keyed by pathname
  $('a[href^="/article/"]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href");
    if (!href) return;
    const url = absolute(href, src.base);
    if (!url || seen.has(url)) return;
    const heading = $a.find("h1,h2,h3,h4,h5,h6").first().text().trim();
    const img = $a.find("img").first();
    const title = heading || (img.attr("alt") ?? "").trim();
    if (!title) return;
    seen.add(url);
    // First real sentence; skip bare timestamps ("16:12") and short byline/label
    // lines. Length-based so it works for both the Hebrew and English editions.
    let excerpt = "";
    $a.find("p").each((_, p) => {
      const text = $(p).text().trim();
      if (excerpt || text.length < 20) return;
      if (/^\d{1,2}:\d{2}$/.test(text)) return;
      excerpt = text;
    });
    const path = pathOf(url);
    out.push({
      url,
      title,
      excerpt: toExcerpt(excerpt),
      // c14's resize proxy serves the src at 3840px wide — far too heavy for a
      // card (and large enough that iOS Safari can drop it). Ask for 1080px.
      image: normalizeImage(
        img.attr("src")?.replace(/\/images\/\d+\//, "/images/1080/"),
        src.base,
      ),
      publishedAt: (path && dates.get(path)) || null,
      sourceId: src.id,
      sourceName: src.name,
    });
  });
  return out;
}

/**
 * Card-list scraper for sites where each headline is an <a> whose visible text
 * *is* the title (Maariv travel, ynetnews). `selector` targets the article
 * links; `skipPrefix` drops nav/category links that share the same path prefix.
 */
function anchorScraper(selector: string, opts: { skipPrefix?: string; minLen?: number } = {}) {
  const minLen = opts.minLen ?? 15;
  const allowed = (href: string | undefined): href is string =>
    !!href && !(opts.skipPrefix && href.startsWith(opts.skipPrefix));
  return (body: string, src: NewsSource): NewsArticle[] => {
    const $ = cheerio.load(body);
    // First pass: map each article URL to its thumbnail. The image can live in a
    // separate anchor sharing the same href (ynetnews), so we collect across all
    // matching anchors, not just the headline one.
    const images = new Map<string, string>();
    $(selector).each((_, el) => {
      const href = $(el).attr("href");
      if (!allowed(href)) return;
      const url = absolute(href, src.base);
      if (!url || images.has(url)) return;
      const img = normalizeImage($(el).find("img").first().attr("src"), src.base);
      if (img) images.set(url, img);
    });
    const out: NewsArticle[] = [];
    const seen = new Set<string>();
    $(selector).each((_, el) => {
      const $a = $(el);
      const href = $a.attr("href");
      if (!allowed(href)) return;
      const url = absolute(href, src.base);
      if (!url || seen.has(url)) return;
      const title = $a.text().replace(/\s+/g, " ").trim();
      if (title.length < minLen) return; // skip icons/"read more"/bare nav links
      seen.add(url);
      out.push({
        url,
        title,
        excerpt: "",
        image: images.get(url) ?? null,
        publishedAt: null,
        sourceId: src.id,
        sourceName: src.name,
      });
    });
    return out;
  };
}

/** Parse ynet's "HH:MM | MM.DD.YY" date label into an ISO string. */
function ynetDate(text: string): string | null {
  const d = text.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  if (!d) return null;
  const t = text.match(/(\d{2}):(\d{2})/);
  const dt = new Date(Date.UTC(2000 + +d[3], +d[1] - 1, +d[2], t ? +t[1] : 0, t ? +t[2] : 0));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

/**
 * ynetnews travel section: each card has a `.dateView` ("HH:MM | MM.DD.YY"), a
 * `.slotTitle > a` (headline) and `.slotSubTitle` (teaser). The thumbnail sits
 * in a separate image anchor sharing the article href, so it's mapped by URL.
 */
function scrapeYnetnews(body: string, src: NewsSource): NewsArticle[] {
  const $ = cheerio.load(body);
  const images = new Map<string, string>();
  $('a[href*="/travel/article/"]').each((_, el) => {
    const href = $(el).attr("href");
    const url = href && absolute(href, src.base);
    if (!url || images.has(url)) return;
    const img = normalizeImage($(el).find("img").first().attr("src"), src.base);
    if (img) images.set(url, img);
  });

  const out: NewsArticle[] = [];
  const seen = new Set<string>();
  $(".slotTitle").each((_, el) => {
    const $title = $(el);
    const $a = $title.find("a").first();
    const href = $a.attr("href");
    if (!href || !href.includes("/travel/article/")) return;
    const url = absolute(href, src.base);
    if (!url || seen.has(url)) return;
    const title = $a.text().replace(/\s+/g, " ").trim();
    if (title.length < 10) return;
    seen.add(url);
    // Climb to the card wrapper that carries the date and teaser.
    let card = $title.parent();
    for (let i = 0; i < 6 && card.length; i++) {
      if (card.find(".dateView").length) break;
      card = card.parent();
    }
    out.push({
      url,
      title,
      excerpt: toExcerpt(card.find(".slotSubTitle").first().text()),
      image: images.get(url) ?? null,
      publishedAt: ynetDate(card.find(".dateView").first().text()),
      sourceId: src.id,
      sourceName: src.name,
    });
  });
  return out;
}

// ── Source registry ──────────────────────────────────────────────────────────

const SOURCES: Record<Locale, NewsSource[]> = {
  he: [
    {
      id: "israelhayom",
      name: "ישראל היום",
      url: "https://www.israelhayom.co.il/rss/rss-379408.xml",
      base: "https://www.israelhayom.co.il",
      parse: parseRss,
      filterPath: "/travel",
      hydrateImages: true, // feed carries no thumbnails; pull og:image per article
    },
    {
      id: "c14",
      name: "ערוץ 14",
      url: "https://www.c14.co.il/archive/55128",
      base: "https://www.c14.co.il",
      parse: scrapeC14,
    },
    {
      id: "ynet",
      name: "ynet",
      url: "https://www.ynet.co.il/Integration/StoryRss598.xml",
      base: "https://www.ynet.co.il",
      parse: parseRss,
    },
    {
      id: "mako",
      name: "mako",
      url: "https://rcs.mako.co.il/rss/888f9edb29436110VgnVCM1000005201000aRCRD.xml",
      base: "https://www.mako.co.il",
      parse: parseRss,
    },
    {
      id: "walla",
      name: "וואלה",
      url: "https://rss.walla.co.il/feed/779",
      base: "https://travel.walla.co.il",
      parse: parseRss,
    },
    {
      id: "globes",
      name: "גלובס",
      url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=9010",
      base: "https://www.globes.co.il",
      parse: parseRss,
    },
    {
      id: "maariv",
      name: "מעריב",
      url: "https://www.maariv.co.il/lifestyle/travel",
      base: "https://www.maariv.co.il",
      parse: anchorScraper('a[href^="/lifestyle/travel/article-"]'),
    },
  ],
  en: [
    {
      id: "c14news",
      name: "Channel 14",
      url: "https://c14news.com/archive/119768",
      base: "https://c14news.com",
      parse: scrapeC14,
    },
    {
      id: "ynetnews",
      name: "ynetnews",
      url: "https://www.ynetnews.com/travel",
      base: "https://www.ynetnews.com",
      parse: scrapeYnetnews,
    },
    {
      id: "jpost",
      name: "The Jerusalem Post",
      url: "https://www.jpost.com/tags/tourism",
      base: "https://www.jpost.com",
      parse: parseItemList,
    },
  ],
};

/** All source ids for a locale, in display order — used for filter chips. */
export function getNewsSources(locale: string): { id: string; name: string }[] {
  const sources = SOURCES[locale as Locale] ?? [];
  return sources.map(({ id, name }) => ({ id, name }));
}

/** Fetch a single article page and return its og:image (absolute), or null. */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS, tags: [NEWS_TAG] },
    });
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());
    const og =
      $('meta[property="og:image"]').attr("content") ??
      $('meta[name="twitter:image"]').attr("content");
    return og ? absolute(og, url) : null;
  } catch {
    return null;
  }
}

async function fetchSource(src: NewsSource): Promise<NewsArticle[]> {
  try {
    const res = await fetch(src.url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS, tags: [NEWS_TAG] },
    });
    if (!res.ok) return [];
    const body = await res.text();
    const articles = src.parse(body, src).slice(0, MAX_PER_SOURCE);
    if (src.hydrateImages) {
      // Backfill missing thumbnails from each article's og:image, in parallel.
      await Promise.all(
        articles.map(async (a) => {
          if (!a.image) a.image = await fetchOgImage(a.url);
        }),
      );
    }
    return articles;
  } catch {
    // Timeout, 403/bot-block, network error or a selector that stopped matching —
    // drop this source and let the others render.
    return [];
  }
}

/**
 * Fetch, merge, de-dupe and sort (newest-first) all sources for a locale. Each
 * source fetch is cached for REVALIDATE_SECONDS, so the feed refreshes in the
 * background at most every 30 min (driven by the page's ISR revalidation).
 */
export async function getNews(locale: string): Promise<NewsArticle[]> {
  const sources = SOURCES[locale as Locale] ?? [];
  const settled = await Promise.allSettled(sources.map(fetchSource));

  const seen = new Set<string>();
  const articles: NewsArticle[] = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const a of result.value) {
      if (seen.has(a.url)) continue;
      seen.add(a.url);
      articles.push(a);
    }
  }

  return articles.sort((a, b) => {
    if (a.publishedAt && b.publishedAt) return b.publishedAt.localeCompare(a.publishedAt);
    if (a.publishedAt) return -1;
    if (b.publishedAt) return 1;
    return 0;
  });
}
