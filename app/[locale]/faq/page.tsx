import { setRequestLocale, getTranslations } from "next-intl/server";
import { can } from "@/lib/auth";
import { getFaqs } from "@/lib/faq";
import { FaqView } from "@/components/faq/faq-view";

/**
 * FAQ — ready-to-send client answers. Public to read (like the other guide
 * pages); editors get inline editing. Some questions carry several answer
 * variants (per product type), each with its own copy button.
 */
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "faq" });
  const [items, canEdit] = await Promise.all([getFaqs(), can("content:edit")]);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground">{t("intro")}</p>
      <FaqView items={items} canEdit={canEdit} />
    </div>
  );
}
