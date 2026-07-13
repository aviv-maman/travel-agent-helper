import { setRequestLocale } from "next-intl/server";
import { getCancellations } from "@/lib/cancellations";
import { CancellationsView } from "@/components/cancellations/cancellations-view";

export default async function CancellationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const cancellations = await getCancellations(locale);
  return <CancellationsView suppliers={cancellations} />;
}
