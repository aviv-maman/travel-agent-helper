import { asc } from "drizzle-orm";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { db } from "@/db";
import { quoteSuppliers } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { QuoteSuppliersTable } from "@/components/account/quote-suppliers-table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

/**
 * Settings editor for the AI quote assistant's supplier-commission table —
 * the reference data the backend's flight-quote skill prices with (replaces
 * the agent's external Google Sheet).
 */
export default async function QuoteCommissionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Security boundary: content editors only (the actions re-check).
  await requirePermission("content:edit", locale);

  const t = await getTranslations({ locale, namespace: "quoteCommissions" });
  const rows = await db
    .select()
    .from(quoteSuppliers)
    .orderBy(asc(quoteSuppliers.sortOrder), asc(quoteSuppliers.id));

  return (
    // Breaks out of the account layout's max-w-3xl on desktop — the 10-column
    // table needs the room (notes were getting clamped). Symmetric negative
    // margins keep it centered; direction-agnostic, so RTL is fine.
    <Card className="lg:mx-[calc((100%-min(72rem,92vw))/2)] lg:w-[min(72rem,92vw)]">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <QuoteSuppliersTable rows={rows} />
        <p className="text-xs leading-relaxed text-muted-foreground">{t("hint")}</p>
      </CardContent>
    </Card>
  );
}
