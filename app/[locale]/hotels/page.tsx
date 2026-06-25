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
      <DestinationCombobox destinations={destinations} />
      {view?.info && <CityInfoAccordion info={view.info} />}
      {!view ? (
        <Alert>
          <InfoIcon />
          <AlertTitle>{t("hotels.emptyTitle")}</AlertTitle>
          <AlertDescription>{t("hotels.emptyHint")}</AlertDescription>
        </Alert>
      ) : (
        view.info?.warnings.map((w, i) => (
          <Alert key={i} className="border-gold/35 bg-gold/10 text-gold">
            <TriangleAlertIcon />
            <AlertTitle>{t("hotels.warningTitle")}</AlertTitle>
            <AlertDescription className="text-gold">{w}</AlertDescription>
          </Alert>
        ))
      )}
      {view && (
        <>
          <Alert className="border-brand/35 bg-brand/10 text-brand">
            <InfoIcon />
            <AlertTitle>{t("hotels.ratingNoteTitle")}</AlertTitle>
            <AlertDescription className="text-brand">{t("hotels.ratingNote")}</AlertDescription>
          </Alert>
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
