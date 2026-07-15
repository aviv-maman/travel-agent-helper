import { setRequestLocale } from "next-intl/server";
import { getTransfers, getTransferSupplierOptions } from "@/lib/transfers";
import { can } from "@/lib/auth";
import { TransfersView } from "@/components/transfers/transfers-view";

export default async function TransfersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [transfers, canEdit] = await Promise.all([getTransfers(locale), can("content:edit")]);
  // Supplier options power the edit dialog — fetched for editors only.
  const suppliers = canEdit ? await getTransferSupplierOptions() : [];
  return <TransfersView groups={transfers} canEdit={canEdit} suppliers={suppliers} />;
}
