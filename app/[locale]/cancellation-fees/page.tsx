import { setRequestLocale } from "next-intl/server";
import { can } from "@/lib/auth";
import { getCancellations, getEditableCancellations } from "@/lib/cancellations";
import { CancellationsView } from "@/components/cancellations/cancellations-view";

export default async function CancellationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [cancellations, canEdit] = await Promise.all([
    getCancellations(locale),
    can("content:edit"),
  ]);
  // Raw bilingual blocks + markup only for editors (drives the edit modal).
  // Raw bilingual blocks + markup only for editors (drives the edit + create UI).
  const editable = canEdit ? await getEditableCancellations() : null;
  return (
    <CancellationsView
      suppliers={cancellations}
      canEdit={canEdit}
      editable={editable}
      signUrl={process.env.FILE_UPLOAD_URL ?? null}
    />
  );
}
