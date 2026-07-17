import { setRequestLocale } from "next-intl/server";
import { getCommissions, getEditableSuppliers } from "@/lib/commissions";
import { getContactsMap } from "@/lib/contacts";
import { can } from "@/lib/auth";
import { CommissionsView } from "@/components/commissions/commissions-view";

export default async function CommissionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [commissions, contacts, canEdit] = await Promise.all([
    getCommissions(locale),
    getContactsMap(),
    can("content:edit"),
  ]);
  // Raw both-locale rows power the inline editors — fetched for editors only.
  const editableSuppliers = canEdit ? await getEditableSuppliers() : null;
  return (
    <CommissionsView
      suppliers={commissions}
      contacts={contacts}
      canEditContacts={canEdit}
      editableSuppliers={editableSuppliers}
    />
  );
}
