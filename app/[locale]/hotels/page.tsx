import { getTranslations, setRequestLocale } from "next-intl/server";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { HotelFeatureValue, HotelTagValue, BoardCode } from "@/db/schema";
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
  const tags = csv("tags") as HotelTagValue[];
  const boards = csv("boards") as BoardCode[];
  const features = csv("features") as HotelFeatureValue[];
  const sort = (asString(sp.sort) ?? "default") as SortMode;
  const page = Math.max(1, Number(asString(sp.page) ?? "1") || 1);
  const perPage = Math.max(0, Number(asString(sp.perPage) ?? "0") || 0);

  const destinations = await getDestinationsList(locale);
  const view = dest
    ? await getDestinationView(dest, {
        tags,
        boards,
        features,
        sort,
        page,
        perPage,
        locale,
      })
    : null;

  return (
    <div className="flex flex-col gap-5">
      <Alert className="border-brand/35 bg-brand/10 text-brand">
        <InfoIcon />
        <AlertTitle>{t("hotels.ratingNoteTitle")}</AlertTitle>
        <AlertDescription className="text-brand/90">{t("hotels.ratingNote")}</AlertDescription>
      </Alert>

      <DestinationCombobox destinations={destinations} />

      {!view && (
        <Alert className="border-warning/35 bg-warning/10 text-warning">
          <TriangleAlertIcon />
          <AlertTitle>{t("hotels.emptyTitle")}</AlertTitle>
          <AlertDescription className="text-warning/90">{t("hotels.emptyHint")}</AlertDescription>
        </Alert>
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
