import { setRequestLocale } from "next-intl/server";
import { getTransfers } from "@/lib/transfers";
import { TransfersView } from "@/components/transfers/transfers-view";

export default async function TransfersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const transfers = await getTransfers(locale);
  return <TransfersView groups={transfers} />;
}
