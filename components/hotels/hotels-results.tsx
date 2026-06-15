"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { HotelGroup, GroupBy, ViewHotel } from "@/lib/hotels";
import { HotelCard } from "./hotel-card";
import { HotelDetailModal } from "./hotel-detail-modal";

const QUALITY_EMOJI: Record<string, string> = { premium: "🏆", good: "👍" };
const BOOKING_KEY: Record<string, string> = {
  "9": "booking9",
  "8": "booking8",
  "7": "booking7",
  lt7: "bookingLt7",
  none: "bookingNone",
};

export function HotelsResults({
  groups,
  groupBy,
}: {
  groups: HotelGroup[];
  groupBy: GroupBy;
}) {
  const t = useTranslations("hotels");
  const [selected, setSelected] = useState<ViewHotel | null>(null);

  const total = groups.reduce((n, g) => n + g.hotels.length, 0);
  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("noResults")}
      </p>
    );
  }

  function label(key: string): string {
    if (groupBy === "quality") {
      return `${QUALITY_EMOJI[key] ?? ""} ${t(`tier.${key}`)}`.trim();
    }
    if (groupBy === "stars") {
      return key === "none"
        ? t("group.starsNone")
        : t("group.stars", { stars: key });
    }
    return t(`group.${BOOKING_KEY[key] ?? "bookingNone"}`);
  }

  return (
    <>
      {groups.map(({ key, hotels }) => (
        <section key={key} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 border-b border-border pb-2 text-sm font-extrabold text-foreground">
            {label(key)}
            <span className="text-xs font-normal text-muted-foreground">
              ({hotels.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((h) => (
              <HotelCard key={h.id} hotel={h} onOpen={() => setSelected(h)} />
            ))}
          </div>
        </section>
      ))}

      <HotelDetailModal hotel={selected} onClose={() => setSelected(null)} />
    </>
  );
}
