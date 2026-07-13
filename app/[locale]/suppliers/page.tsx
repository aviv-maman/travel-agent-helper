import { setRequestLocale } from "next-intl/server";
import { getCommissions } from "@/lib/commissions";
import { getContactsMap } from "@/lib/contacts";
import { can } from "@/lib/auth";
import { CommissionsView } from "@/components/commissions/commissions-view";

export default async function CommissionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [commissions, contacts, canEditContacts] = await Promise.all([
    getCommissions(locale),
    getContactsMap(),
    can("content:edit"),
  ]);
  return (
    <CommissionsView
      suppliers={commissions}
      contacts={contacts}
      canEditContacts={canEditContacts}
    />
  );
}
