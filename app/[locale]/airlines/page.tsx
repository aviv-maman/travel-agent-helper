import { setRequestLocale } from "next-intl/server";
import { getAirlines } from "@/lib/airlines";
import { getContactsMap } from "@/lib/contacts";
import { can } from "@/lib/auth";
import { AirlineView } from "@/components/airline/airline-view";

export default async function AirlinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [airlines, contacts, canEditContacts] = await Promise.all([
    getAirlines(locale),
    getContactsMap(),
    can("content:edit"),
  ]);
  return (
    <AirlineView airlines={airlines} contacts={contacts} canEditContacts={canEditContacts} />
  );
}
