import { setRequestLocale } from "next-intl/server";
import { getCommissions } from "@/lib/commissions";
import { CommissionsView } from "@/components/commissions/commissions-view";

export default async function CommissionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const commissions = getCommissions(locale);
  return <CommissionsView suppliers={commissions} />;
}
