"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import type { NewsArticle } from "@/lib/news";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Source favicon from public/news/{id}.png; renders nothing if the file is missing. */
function SourceLogo({ id, className }: { id: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/news/${id}.png`}
      alt=""
      aria-hidden
      className={cn("size-3.5 shrink-0 rounded-[3px] object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
}

export function NewsList({
  articles,
  sources,
}: {
  articles: NewsArticle[];
  sources: { id: string; name: string }[];
}) {
  const t = useTranslations("news");
  const locale = useLocale();
  const [active, setActive] = useState<string>("all");

  const filtered = useMemo(
    () => (active === "all" ? articles : articles.filter((a) => a.sourceId === active)),
    [articles, active],
  );

  if (articles.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface/50 px-5 py-10 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  const chips = [{ id: "all", name: t("allSources") }, ...sources];

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {t("intro")}
      </p>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const isActive = active === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActive(chip.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                isActive
                  ? "border-brand/40 bg-brand/15 text-brand"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}>
              {chip.id !== "all" && <SourceLogo id={chip.id} />}
              {chip.name}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((article) => {
          const date = formatDate(article.publishedAt, locale);
          return (
            <a
              key={article.url}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-colors hover:ring-brand/40">
              {article.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.image}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="aspect-video w-full object-cover"
                />
              )}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1 border-brand/35 bg-brand/10 text-[0.65rem] font-semibold text-brand">
                    <SourceLogo id={article.sourceId} className="size-3" />
                    {article.sourceName}
                  </Badge>
                  {date && <span className="text-xs text-muted-foreground">{date}</span>}
                </div>
                <h2 className="text-sm leading-snug font-bold text-foreground group-hover:text-brand">
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {article.excerpt}
                  </p>
                )}
                <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-brand">
                  {t("readMore")}
                  <ExternalLink className="size-3" />
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
