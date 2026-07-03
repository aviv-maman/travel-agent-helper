import { setRequestLocale } from "next-intl/server";
import { getAirlines } from "@/lib/airlines";
import { AirlineView } from "@/components/airline/airline-view";

export default async function AirlinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const airlines = getAirlines(locale);
  return <AirlineView airlines={airlines} />;
}
