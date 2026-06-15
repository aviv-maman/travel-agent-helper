"use client";

import { useLocale, useTranslations } from "next-intl";
import { MapPin, ExternalLink } from "lucide-react";
import type { HotelFeatureValue, HotelTier, HotelTagValue } from "@/db/schema";
import type { ViewHotel, ViewDistance } from "@/lib/hotels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "./copy-link-button";

const FEATURE_META: Record<HotelFeatureValue, { emoji: string; key: string }> = {
  "pool-in": { emoji: "🏊", key: "poolIn" },
  "pool-out": { emoji: "🌤", key: "poolOut" },
  casino: { emoji: "🎰", key: "casino" },
  "casino-near": { emoji: "🎰", key: "casinoNear" },
  waterpark: { emoji: "🎢", key: "waterpark" },
  "outside-center": { emoji: "📍", key: "outsideCenter" },
};

const TIER_EMOJI: Record<HotelTier, string> = { premium: "🏆", good: "👍" };
const TAG_EMOJI: Record<HotelTagValue, string> = { resort: "🎢", kosher: "✡" };

export function formatMeters(m: number | null, locale: string): string | null {
  if (m == null) return null;
  if (m < 1000) return locale === "he" ? `${m}מ׳` : `${m}m`;
  const km = (m / 1000).toFixed(1);
  return locale === "he" ? `${km} ק״מ` : `${km}km`;
}

/** Builds the localized "X minutes walking · Y minutes riding" string. */
export function useTimeLabel() {
  const t = useTranslations("hotels.card");
  return (d: ViewDistance): string => {
    const parts: string[] = [];
    if (d.walkMinutes != null) parts.push(t("walk", { minutes: d.walkMinutes }));
    if (d.rideMinutes != null) parts.push(t("ride", { minutes: d.rideMinutes }));
    return parts.join(" · ");
  };
}

export function HotelCard({
  hotel,
  onOpen,
}: {
  hotel: ViewHotel;
  onOpen: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("hotels");
  const timeLabel = useTimeLabel();

  // Open the modal on card click, but ignore clicks on inner links/buttons.
  function handleActivate(e: React.MouseEvent | React.KeyboardEvent) {
    if (e.target instanceof HTMLElement && e.target.closest("a, button")) return;
    onOpen();
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate(e);
        }
      }}
      className="flex cursor-pointer flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-brand/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-foreground">{hotel.name}</h3>
        <span className="text-xl" aria-hidden>
          🏨
        </span>
      </div>

      <div className="flex items-center gap-2">
        {hotel.stars != null && (
          <>
            <span className="text-gold" aria-hidden>
              {"★".repeat(hotel.stars)}
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              {hotel.stars}★
            </span>
          </>
        )}
      </div>

      {/* Quality tier + tags */}
      <div className="flex flex-wrap gap-1.5">
        <Badge className="bg-brand/15 text-xs font-bold text-brand">
          {TIER_EMOJI[hotel.tier]} {t(`tier.${hotel.tier}`)}
        </Badge>
        {hotel.tags.map((tag) => (
          <Badge
            key={tag}
            className="bg-purple/15 text-xs font-bold text-purple"
          >
            {TAG_EMOJI[tag]} {t(`tier.${tag}`)}
          </Badge>
        ))}
      </div>

      {hotel.boards.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hotel.boards.map((b) => (
            <Badge key={b} variant="secondary" className="text-xs">
              {t(`board.${b}`)}
            </Badge>
          ))}
        </div>
      )}

      {hotel.features.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hotel.features.map((f) => (
            <Badge
              key={f}
              variant="outline"
              className="border-border text-xs font-semibold"
            >
              <span aria-hidden>{FEATURE_META[f].emoji}</span>{" "}
              {t(`filter.${FEATURE_META[f].key}`)}
            </Badge>
          ))}
        </div>
      )}

      {hotel.bookingScore != null && (
        <div className="flex items-center gap-1.5 text-sm font-bold text-success">
          <span className="inline-block size-2 rounded-full bg-success" aria-hidden />
          {t("card.bookingScore")} {hotel.bookingScore}
        </div>
      )}

      <div className="mt-1 flex items-center gap-2">
        {hotel.googleMapsUrl && (
          <>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="h-8 flex-1 text-brand"
              render={
                <a href={hotel.googleMapsUrl} target="_blank" rel="noreferrer" />
              }
            >
              <MapPin className="size-3.5" /> {t("card.maps")}
            </Button>
            <CopyLinkButton url={hotel.googleMapsUrl} />
          </>
        )}
        {hotel.bookingUrl && (
          <>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="h-8 flex-1 text-success"
              render={
                <a href={hotel.bookingUrl} target="_blank" rel="noreferrer" />
              }
            >
              <ExternalLink className="size-3.5" /> {t("card.booking")}
            </Button>
            <CopyLinkButton url={hotel.bookingUrl} />
          </>
        )}
      </div>

      {hotel.distances.length > 0 && (
        <table className="mt-1 w-full text-xs text-muted-foreground">
          <tbody>
            {hotel.distances.map((d) => (
              <tr key={d.landmarkKey}>
                <td className="py-0.5 text-start text-foreground">
                  {d.name}
                </td>
                <td className="py-0.5 text-end font-bold text-gold whitespace-nowrap">
                  {timeLabel(d)}
                </td>
                <td className="py-0.5 text-end ps-2 text-[0.68rem]">
                  {formatMeters(d.meters, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
