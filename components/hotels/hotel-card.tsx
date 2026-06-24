"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MapPin, ExternalLink, Star } from "lucide-react";
import type { HotelFeatureValue, HotelTagValue, BoardCode } from "@/db/schema";
import type { ViewHotel, ViewDistance } from "@/lib/hotels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CopyLinkButton } from "./copy-link-button";
import type { ViewMode } from "./use-view-mode";
import { useHotelParams } from "./use-hotel-params";

type FilterKey = keyof (typeof import("@/messages/en.json"))["hotels"]["filter"];

const FEATURE_META: Record<HotelFeatureValue, { emoji: string; key: FilterKey }> = {
  "pool-in": { emoji: "🏊", key: "poolIn" },
  "pool-out": { emoji: "🌊", key: "poolOut" },
  casino: { emoji: "🎰", key: "casino" },
  "casino-near": { emoji: "🎰", key: "casinoNear" },
  waterpark: { emoji: "🎢", key: "waterpark" },
  "outside-center": { emoji: "📍", key: "outsideCenter" },
};

const TAG_EMOJI: Record<HotelTagValue, string> = { resort: "🎢", kosher: "✡️" };
const BOARD_EMOJI: Record<BoardCode, string> = { bb: "🍳", hb: "🍴", fb: "🍽️" };

const BADGE_TINT = {
  tag: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  board: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  feature:
    "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
} as const;

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
    // Always surface a walking time — even for very close (<100m) spots where the
    // data has no explicit minutes — so the yellow column is never empty.
    if (parts.length === 0 && d.meters != null) {
      parts.push(t("walk", { minutes: Math.max(1, Math.round(d.meters / 80)) }));
    }
    return parts.join(" · ");
  };
}

export function HotelCard({
  hotel,
  layout = "grid",
  onOpen,
}: {
  hotel: ViewHotel;
  layout?: ViewMode;
  onOpen: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("hotels");
  const timeLabel = useTimeLabel();
  const { sort } = useHotelParams();

  // When sorting by distance to a landmark, surface that landmark's row first
  // and mark it as selected.
  const activeKey = sort.startsWith("dist:") ? sort.slice(5) : null;
  const distances = useMemo(() => {
    if (!activeKey) return hotel.distances;
    const i = hotel.distances.findIndex((d) => d.landmarkKey === activeKey);
    if (i <= 0) return hotel.distances;
    const copy = [...hotel.distances];
    const [selected] = copy.splice(i, 1);
    return [selected, ...copy];
  }, [hotel.distances, activeKey]);

  // Open the modal on card click, but ignore clicks on inner links/buttons.
  function handleActivate(e: React.MouseEvent | React.KeyboardEvent) {
    if (e.target instanceof HTMLElement && e.target.closest("a, button")) return;
    onOpen();
  }

  const rootProps = {
    role: "button" as const,
    tabIndex: 0,
    onClick: handleActivate,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleActivate(e);
      }
    },
    className:
      "group/hotel cursor-pointer gap-0 py-0 ring-foreground/10 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-brand/[0.04] hover:shadow-lg hover:shadow-brand/10 hover:ring-2 hover:ring-brand/50 focus-visible:-translate-y-0.5 focus-visible:bg-brand/[0.04] focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none",
  };

  const ratings = (
    <div className="flex shrink-0 items-center gap-1.5">
      {hotel.stars != null && (
        <span
          aria-label={`${hotel.stars} stars`}
          className="inline-flex items-center gap-0.5 rounded-md bg-gold/10 px-1.5 py-0.5 text-xs font-bold text-gold">
          {Array.from({ length: hotel.stars }).map((_, i) => (
            <Star key={i} className="size-3 fill-current" />
          ))}
          {hotel.stars}
        </span>
      )}
      {hotel.bookingScore != null && (
        <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-1.5 py-0.5 text-xs font-bold text-success">
          {t("card.booking")} {hotel.bookingScore}
        </span>
      )}
    </div>
  );

  const hasBadges = hotel.tags.length > 0 || hotel.boards.length > 0 || hotel.features.length > 0;
  const badges = hasBadges && (
    <div className="flex flex-wrap gap-1.5">
      {hotel.tags.map((tag) => (
        <Badge key={tag} className={BADGE_TINT.tag}>
          {TAG_EMOJI[tag]} {t(`tier.${tag}`)}
        </Badge>
      ))}
      {hotel.boards.map((b) => (
        <Badge key={b} className={BADGE_TINT.board}>
          {BOARD_EMOJI[b]} {t(`board.${b}`)}
        </Badge>
      ))}
      {hotel.features.map((f) => (
        <Badge key={f} className={BADGE_TINT.feature}>
          {FEATURE_META[f].emoji} {t(`filter.${FEATURE_META[f].key}`)}
        </Badge>
      ))}
    </div>
  );

  const actions = (hotel.googleMapsUrl || hotel.bookingUrl) && (
    <div className="flex flex-col gap-2">
      {hotel.googleMapsUrl && (
        <ButtonGroup className="w-full">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            className="h-8 flex-1 text-brand"
            render={<a href={hotel.googleMapsUrl} target="_blank" rel="noreferrer" />}>
            <MapPin className="size-3.5" /> {t("card.maps")}
          </Button>
          <CopyLinkButton url={hotel.googleMapsUrl} className="size-8 shrink-0" />
        </ButtonGroup>
      )}
      {hotel.bookingUrl && (
        <ButtonGroup className="w-full">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            className="h-8 flex-1 text-success"
            render={<a href={hotel.bookingUrl} target="_blank" rel="noreferrer" />}>
            <ExternalLink className="size-3.5" /> {t("card.booking")}
          </Button>
          <CopyLinkButton url={hotel.bookingUrl} className="size-8 shrink-0" />
        </ButtonGroup>
      )}
    </div>
  );

  const distanceTable = distances.length > 0 && (
    <table className="w-full border-separate border-spacing-y-0.5 text-xs text-muted-foreground">
      <tbody>
        {distances.map((d) => {
          const isSelected = d.landmarkKey === activeKey;
          return (
            <tr key={d.landmarkKey} className={isSelected ? "bg-brand/10" : undefined}>
              <td
                className={`py-0.5 ps-1.5 text-start ${
                  isSelected ? "rounded-s-md font-bold text-brand" : "text-foreground"
                }`}>
                {isSelected && <span aria-hidden>📌 </span>}
                {d.name}
              </td>
              <td className="py-0.5 text-end font-bold whitespace-nowrap text-gold">
                {timeLabel(d)}
              </td>
              <td
                className={`py-0.5 ps-2 pe-1.5 text-end text-[0.68rem] ${
                  isSelected ? "rounded-e-md" : ""
                }`}>
                {formatMeters(d.meters, locale)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  if (layout === "list") {
    const listActions = (hotel.googleMapsUrl || hotel.bookingUrl) && (
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {hotel.googleMapsUrl && (
          <ButtonGroup>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="h-8 text-brand"
              render={<a href={hotel.googleMapsUrl} target="_blank" rel="noreferrer" />}>
              <MapPin className="size-3.5" /> {t("card.maps")}
            </Button>
            <CopyLinkButton url={hotel.googleMapsUrl} className="size-8 shrink-0" />
          </ButtonGroup>
        )}
        {hotel.bookingUrl && (
          <ButtonGroup>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="h-8 text-success"
              render={<a href={hotel.bookingUrl} target="_blank" rel="noreferrer" />}>
              <ExternalLink className="size-3.5" /> {t("card.booking")}
            </Button>
            <CopyLinkButton url={hotel.bookingUrl} className="size-8 shrink-0" />
          </ButtonGroup>
        )}
      </div>
    );

    return (
      <Card {...rootProps}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <h3 className="text-base font-bold text-foreground transition-colors group-hover/hotel:text-brand">
                {hotel.name}
              </h3>
              {ratings}
            </div>
            {badges}
            {distanceTable && <div className="pt-0.5">{distanceTable}</div>}
            {/* Compact, non-stretched action buttons — mobile only. */}
            {listActions && <div className="sm:hidden">{listActions}</div>}
          </div>
          {/* Desktop: original action column. */}
          {actions && <div className="hidden shrink-0 sm:block sm:w-48">{actions}</div>}
        </div>
      </Card>
    );
  }

  return (
    <Card {...rootProps} className={`${rootProps.className} h-full`}>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="text-base leading-snug font-bold text-foreground transition-colors group-hover/hotel:text-brand">
          {hotel.name}
        </h3>
        {ratings}
        {badges}
        {distanceTable}
      </div>
      {actions && (
        <>
          <Separator />
          <div className="bg-muted/30 p-3">{actions}</div>
        </>
      )}
    </Card>
  );
}
