import { setRequestLocale } from "next-intl/server";
import { getBaggage } from "@/lib/baggage";
import { BaggageView } from "@/components/baggage/baggage-view";

export default async function BaggagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const baggage = getBaggage(locale);
  return <BaggageView airlines={baggage} />;
}
