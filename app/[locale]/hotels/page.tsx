import { getTranslations, setRequestLocale } from "next-intl/server";
import type { HotelFeatureValue, HotelTier, HotelTagValue, BoardCode } from "@/db/schema";
import { getDestinationsList, getDestinationView, type SortMode } from "@/lib/hotels";
import { DestinationCombobox } from "@/components/hotels/destination-combobox";
import { HotelFilters } from "@/components/hotels/hotel-filters";
import { HotelsResults } from "@/components/hotels/hotels-results";
import { HotelsPager } from "@/components/hotels/hotels-pager";
import { CityInfoAccordion } from "@/components/hotels/city-info-accordion";

function asString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function HotelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  const sp = await searchParams;
  const csv = (key: string) => (asString(sp[key]) ?? "").split(",").filter(Boolean);

  const dest = asString(sp.dest);
  const quality = csv("quality") as HotelTier[];
  const tags = csv("tags") as HotelTagValue[];
  const boards = csv("boards") as BoardCode[];
  const features = csv("features") as HotelFeatureValue[];
  const minBookingRaw = asString(sp.minBooking);
  const minBooking = minBookingRaw ? Number(minBookingRaw) : undefined;
  const sort = (asString(sp.sort) ?? "default") as SortMode;
  const page = Math.max(1, Number(asString(sp.page) ?? "1") || 1);
  const perPage = Math.max(0, Number(asString(sp.perPage) ?? "0") || 0);

  const destinations = await getDestinationsList(locale);
  const view = dest
    ? await getDestinationView(dest, {
        quality,
        tags,
        boards,
        features,
        minBooking,
        sort,
        page,
        perPage,
        locale,
      })
    : null;

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
        ℹ️ {t("hotels.ratingNote")}
      </p>

      <DestinationCombobox destinations={destinations} />

      {!view && (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 px-5 py-10 text-center">
          <p className="text-base font-bold text-foreground">{t("hotels.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("hotels.emptyHint")}</p>
        </div>
      )}

      {view && (
        <>
          {view.info?.warnings.map((w, i) => (
            <div
              key={i}
              className="rounded-xl border border-gold/35 bg-gold/10 px-4 py-3 text-sm leading-relaxed font-bold text-gold">
              {w}
            </div>
          ))}

          {view.info && <CityInfoAccordion info={view.info} />}

          <HotelFilters landmarks={view.landmarks} />

          <HotelsResults hotels={view.hotels} />

          <HotelsPager
            total={view.total}
            page={view.page}
            perPage={view.perPage}
            totalPages={view.totalPages}
          />
        </>
      )}
    </div>
  );
}
