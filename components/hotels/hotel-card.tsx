"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLinkIcon, Globe, Star } from "lucide-react";
import { GoogleMapsIcon } from "@/components/icons/google-maps-icon";
import { GoogleIcon } from "@/components/icons/google-icon";
import { BookingIcon } from "@/components/icons/booking-icon";
import { BookingScore } from "./booking-score";
import type { HotelFeatureValue, HotelTagValue, BoardCode } from "@/db/schema";
import type { ViewHotel, ViewDistance } from "@/lib/hotels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CopyLinkButton } from "./copy-link-button";
import { EditBookingScore } from "./edit-booking-score";
import type { ViewMode } from "./view-mode";
import { useHotelParams } from "./use-hotel-params";

type FilterKey = keyof (typeof import("@/messages/en.json"))["hotels"]["filter"];

const FEATURE_META: Record<HotelFeatureValue, { emoji: string; key: FilterKey }> = {
  "pool-in": { emoji: "🏊", key: "poolIn" },
  "pool-out": { emoji: "🌊", key: "poolOut" },
  casino: { emoji: "🎰", key: "casino" },
  "casino-near": { emoji: "🎰", key: "casinoNear" },
  waterpark: { emoji: "🛝", key: "waterpark" },
  spa: { emoji: "🧖", key: "spa" },
  "outside-center": { emoji: "📍", key: "outsideCenter" },
};

const TAG_EMOJI: Record<HotelTagValue, string> = {
  resort: "🎢",
  kosher: "✡️",
  aparthotel: "🏢",
  "adults-only": "🔞",
};
const BOARD_EMOJI: Record<BoardCode, string> = { bb: "🍳", hb: "🍴", fb: "🍽️" };

const BADGE_TINT = {
  tag: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  board: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  feature: "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
} as const;

// Most tags share the amber tint; kosher gets purple to match its ✡️ emoji.
const TAG_TINT: Partial<Record<HotelTagValue, string>> = {
  kosher:
    "border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

export function formatMeters(m: number | null, locale: string): string | null {
  if (m == null) return null;
  if (m < 1000) return locale === "he" ? `${m}מ׳` : `${m}m`;
  const km = (m / 1000).toFixed(1);
  return locale === "he" ? `${km} ק״מ` : `${km}km`;
}

/** Walks longer than this aren't a realistic option — show the ride time only. */
const MAX_USEFUL_WALK_MINUTES = 40;

/** Builds the localized "X minutes walking · Y minutes riding" string. */
export function useTimeLabel() {
  const t = useTranslations("hotels.card");
  return (d: ViewDistance): string => {
    const parts: string[] = [];
    const walkIsUseful =
      d.walkMinutes != null && (d.walkMinutes <= MAX_USEFUL_WALK_MINUTES || d.rideMinutes == null);
    if (walkIsUseful) parts.push(t("walk", { minutes: d.walkMinutes! }));
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
  canEdit = false,
}: {
  hotel: ViewHotel;
  layout?: ViewMode;
  onOpen: () => void;
  canEdit?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("hotels");
  const timeLabel = useTimeLabel();
  const { sort } = useHotelParams();

  // Editors can adjust the Booking score inline; the badge reads from local
  // state so an edit reflects immediately (revalidation syncs other sessions).
  // Only DB-backed hotels have a numeric id — the seed fallback can't persist.
  const [score, setScore] = useState(hotel.bookingScore);
  const canEditScore = canEdit && /^\d+$/.test(hotel.id);

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

  // Open the modal on card click, but ignore interactions with inner controls —
  // links, buttons, form fields, and the (portaled) Booking-score edit popover,
  // whose events still bubble through the React tree to this handler.
  function handleActivate(e: React.MouseEvent | React.KeyboardEvent) {
    if (
      e.target instanceof HTMLElement &&
      e.target.closest("a, button, input, textarea, select, label, [data-slot='popover-content']")
    ) {
      return;
    }
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

  // Google photo (a key-free googleusercontent URL from the Places enrichment).
  // Hidden entirely when absent or the URL has gone stale (load error) — cards
  // without a photo look exactly as before.
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = (sizes: string, className: string) =>
    hotel.photoUrl &&
    !photoFailed && (
      <div className={`relative shrink-0 overflow-hidden bg-muted ${className}`}>
        <Image
          src={hotel.photoUrl}
          alt={hotel.name}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-200 ease-out group-hover/hotel:scale-105"
          onError={() => setPhotoFailed(true)}
        />
      </div>
    );

  // The line follows the page direction (right-aligned in Hebrew); only the
  // English address text itself is forced LTR so it reads correctly.
  const address = hotel.address && (
    <p className="truncate text-xs text-muted-foreground" title={hotel.address}>
      <span aria-hidden>📍 </span>
      <span dir="ltr">{hotel.address}</span>
    </p>
  );

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
      {hotel.googleRating != null && (
        // Explicit flex pieces (not one bidi string) so the order is stable in
        // both directions: in Hebrew the rating sits on the right, then the G
        // mark, and the review count lands on the LEFT of the chip.
        <span
          aria-label={`Google ${hotel.googleRating}`}
          className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand">
          <span dir="ltr">★ {hotel.googleRating}</span>
          <GoogleIcon className="size-3 shrink-0" />
          {hotel.googleReviewCount != null && (
            <span className="font-medium">
              ({t("card.reviews", { count: hotel.googleReviewCount.toLocaleString(locale) })})
            </span>
          )}
        </span>
      )}
      {/* Booking score + its edit pencil stay adjacent (the pencil is last, so
          on RTL it's the leftmost item — right next to the Booking score).
          Pilot hotels get the large vertical badge; the rest the inline chip. */}
      {score != null && <BookingScore score={score} />}
      {canEditScore && (
        <EditBookingScore hotelId={Number(hotel.id)} value={score} onSaved={setScore} />
      )}
    </div>
  );

  const hasBadges = hotel.tags.length > 0 || hotel.boards.length > 0 || hotel.features.length > 0;
  const badges = hasBadges && (
    <div className="flex flex-wrap gap-1.5">
      {hotel.tags.map((tag) => (
        <Badge key={tag} className={TAG_TINT[tag] ?? BADGE_TINT.tag}>
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

  const actions = (hotel.googleMapsUrl || hotel.bookingUrl || hotel.websiteUrl) && (
    // Full-width link rows on the grid card (admin request 2026-07-18).
    <div className="flex w-full flex-col gap-2">
      {hotel.googleMapsUrl && (
        <ButtonGroup className="w-full">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            className="h-8 flex-1 text-red-600 dark:text-red-500"
            render={<a href={hotel.googleMapsUrl} target="_blank" rel="noreferrer" />}>
            <ExternalLinkIcon className="size-3.5" />
            {t("card.maps")}
            <GoogleMapsIcon className="size-3.5" />
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
            className="h-8 flex-1 text-blue-600 dark:text-blue-500"
            render={<a href={hotel.bookingUrl} target="_blank" rel="noreferrer" />}>
            <ExternalLinkIcon className="size-3.5" />
            {t("card.booking")}
            <BookingIcon className="size-3.5" />
          </Button>
          <CopyLinkButton url={hotel.bookingUrl} className="size-8 shrink-0" />
        </ButtonGroup>
      )}
      {/* The hotel's own site sits right below the Booking.com link. */}
      {hotel.websiteUrl && (
        <ButtonGroup className="w-full">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            className="h-8 flex-1"
            render={<a href={hotel.websiteUrl} target="_blank" rel="noreferrer" />}>
            <ExternalLinkIcon className="size-3.5" />
            {t("card.website")}
            <Globe className="size-3.5" />
          </Button>
          <CopyLinkButton url={hotel.websiteUrl} className="size-8 shrink-0" />
        </ButtonGroup>
      )}
    </div>
  );

  const distanceTable = distances.length > 0 && (
    <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {distances.map((d) => {
        const isSelected = d.landmarkKey === activeKey;
        return (
          <li
            key={d.landmarkKey}
            className={`flex items-baseline gap-2 rounded-md px-1.5 py-0.5 ${
              isSelected ? "bg-brand/10 font-bold text-brand" : ""
            }`}>
            <span className={isSelected ? undefined : "text-foreground"}>
              {isSelected && <span aria-hidden>📌 </span>}
              {d.name}
            </span>
            <span
              aria-hidden
              className="min-w-3 flex-1 translate-y-[-0.2em] border-b border-dotted border-muted-foreground/30"
            />
            <span className="font-bold whitespace-nowrap text-gold">{timeLabel(d)}</span>
            <span className="w-7 text-[0.68rem] whitespace-nowrap tabular-nums">
              {formatMeters(d.meters, locale)}
            </span>
          </li>
        );
      })}
    </ul>
  );

  if (layout === "list") {
    const listActions = (hotel.googleMapsUrl || hotel.bookingUrl || hotel.websiteUrl) && (
      <div className="flex w-full flex-wrap items-center gap-2">
        {hotel.googleMapsUrl && (
          <ButtonGroup className="flex-1 sm:flex-none">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="h-8 flex-1 text-red-600 sm:flex-none dark:text-red-500"
              render={<a href={hotel.googleMapsUrl} target="_blank" rel="noreferrer" />}>
              <ExternalLinkIcon className="size-3.5" />
              {t("card.maps")}
              <GoogleMapsIcon className="size-3.5" />
            </Button>
            <CopyLinkButton url={hotel.googleMapsUrl} className="size-8 shrink-0" />
          </ButtonGroup>
        )}
        {hotel.bookingUrl && (
          <ButtonGroup className="flex-1 sm:flex-none">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="h-8 flex-1 text-blue-600 sm:flex-none dark:text-blue-500"
              render={<a href={hotel.bookingUrl} target="_blank" rel="noreferrer" />}>
              <ExternalLinkIcon className="size-3.5" />
              {t("card.booking")}
              <BookingIcon className="size-3.5" />
            </Button>
            <CopyLinkButton url={hotel.bookingUrl} className="size-8 shrink-0" />
          </ButtonGroup>
        )}
        {hotel.websiteUrl && (
          <ButtonGroup className="flex-1 sm:flex-none">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="h-8 flex-1 sm:flex-none"
              render={<a href={hotel.websiteUrl} target="_blank" rel="noreferrer" />}>
              <ExternalLinkIcon className="size-3.5" />
              {t("card.website")}
              <Globe className="size-3.5" />
            </Button>
            <CopyLinkButton url={hotel.websiteUrl} className="size-8 shrink-0" />
          </ButtonGroup>
        )}
      </div>
    );

    return (
      <Card {...rootProps}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-5">
          {/* First flex child = the start side — the RIGHT side in RTL. */}
          {photo("(min-width: 640px) 11rem, 100vw", "aspect-[16/10] w-full rounded-lg sm:w-44")}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <h3 className="text-base font-bold text-foreground transition-colors group-hover/hotel:text-brand">
                {hotel.name}
              </h3>
              {ratings}
            </div>
            {address}
            {badges}
            {distanceTable && <div className="max-w-md pt-0.5">{distanceTable}</div>}
            {/* Compact, non-stretched action buttons — mobile only. */}
            {listActions && <div className="sm:hidden">{listActions}</div>}
          </div>
          {/* Desktop: the action column stretches to the row's full height and
              centers its buttons — top-hugging links looked off. */}
          {actions && (
            <div className="hidden shrink-0 sm:flex sm:items-center sm:self-stretch">{actions}</div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card {...rootProps} className={`${rootProps.className} h-full overflow-hidden`}>
      {photo("(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw", "aspect-[16/10] w-full")}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="text-base leading-snug font-bold text-foreground transition-colors group-hover/hotel:text-brand">
          {hotel.name}
        </h3>
        {address}
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
