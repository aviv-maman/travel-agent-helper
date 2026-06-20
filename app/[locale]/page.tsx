import { getTranslations, setRequestLocale } from "next-intl/server";
import type { HotelFeatureValue, HotelTier, HotelTagValue, BoardCode } from "@/db/schema";
import { getDestinationsList, getDestinationView, type SortMode, type GroupBy } from "@/lib/hotels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { DestinationCombobox } from "@/components/hotels/destination-combobox";
import { HotelFilters } from "@/components/hotels/hotel-filters";
import { HotelsResults } from "@/components/hotels/hotels-results";
import { HotelsPager } from "@/components/hotels/hotels-pager";
import { CityInfoAccordion } from "@/components/hotels/city-info-accordion";
import { getCommissions } from "@/lib/commissions";
import { CommissionsView } from "@/components/commissions/commissions-view";
import { getTransfers } from "@/lib/transfers";
import { TransfersView } from "@/components/transfers/transfers-view";
import { getBaggage } from "@/lib/baggage";
import { BaggageView } from "@/components/baggage/baggage-view";
import { getCancellations } from "@/lib/cancellations";
import { CancellationsView } from "@/components/cancellations/cancellations-view";

function asString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

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
  const groupBy = (asString(sp.groupBy) ?? "quality") as GroupBy;
  const page = Math.max(1, Number(asString(sp.page) ?? "1") || 1);
  const perPage = Math.max(0, Number(asString(sp.perPage) ?? "0") || 0);

  const commissions = getCommissions(locale);
  const transfers = getTransfers(locale);
  const baggage = getBaggage(locale);
  const cancellations = getCancellations(locale);
  const destinations = await getDestinationsList(locale);
  const view = dest
    ? await getDestinationView(dest, {
        quality,
        tags,
        boards,
        features,
        minBooking,
        sort,
        groupBy,
        page,
        perPage,
        locale,
      })
    : null;

  // Stack icon over label on mobile, fall back to the inline pill on sm+.
  const triggerCls =
    "h-auto flex-col gap-0.5 py-1.5 sm:h-[calc(100%-1px)] sm:flex-row sm:gap-1.5 sm:py-0.5";
  const tabIconCls = "text-lg sm:text-base";
  const tabTextCls = "text-[0.65rem] leading-tight sm:text-sm";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{t("app.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("app.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>

      <Tabs defaultValue="hotels" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-5 group-data-horizontal/tabs:h-auto sm:group-data-horizontal/tabs:h-8">
          <TabsTrigger
            value="commissions"
            title={t("tabs.commissions")}
            className={triggerCls}
          >
            <span className={tabIconCls} aria-hidden>
              💰
            </span>
            <span className={tabTextCls}>{t("tabs.commissions")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="transfers"
            title={t("tabs.transfers")}
            className={triggerCls}
          >
            <span className={tabIconCls} aria-hidden>
              🚌
            </span>
            <span className={tabTextCls}>{t("tabs.transfers")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="baggage"
            title={t("tabs.baggage")}
            className={triggerCls}
          >
            <span className={tabIconCls} aria-hidden>
              🧳
            </span>
            <span className={tabTextCls}>{t("tabs.baggage")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="cancellations"
            title={t("tabs.cancellations")}
            className={triggerCls}
          >
            <span className={tabIconCls} aria-hidden>
              ❌
            </span>
            <span className={tabTextCls}>{t("tabs.cancellations")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="hotels"
            title={t("tabs.hotels")}
            className={triggerCls}
          >
            <span className={tabIconCls} aria-hidden>
              🏨
            </span>
            <span className={tabTextCls}>{t("tabs.hotels")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commissions" className="py-6">
          <CommissionsView suppliers={commissions} />
        </TabsContent>
        <TabsContent value="transfers" className="py-6">
          <TransfersView groups={transfers} />
        </TabsContent>
        <TabsContent value="baggage" className="py-6">
          <BaggageView airlines={baggage} />
        </TabsContent>
        <TabsContent value="cancellations" className="py-6">
          <CancellationsView suppliers={cancellations} />
        </TabsContent>

        <TabsContent value="hotels" className="py-6">
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

                <HotelsResults groups={view.groups} groupBy={view.groupBy} />

                <HotelsPager
                  total={view.total}
                  page={view.page}
                  perPage={view.perPage}
                  totalPages={view.totalPages}
                />
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
