"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ViewHotel } from "@/lib/hotels";
import { HotelCard } from "./hotel-card";
import { HotelDetailModal } from "./hotel-detail-modal";

export function HotelsResults({ hotels }: { hotels: ViewHotel[] }) {
  const t = useTranslations("hotels");
  const [selected, setSelected] = useState<ViewHotel | null>(null);

  if (hotels.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("noResults")}
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hotels.map((h) => (
          <HotelCard key={h.id} hotel={h} onOpen={() => setSelected(h)} />
        ))}
      </div>

      <HotelDetailModal hotel={selected} onClose={() => setSelected(null)} />
    </>
  );
}
