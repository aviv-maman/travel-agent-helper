import { setRequestLocale, getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth";
import { listInvites } from "@/lib/auth/invites";
import { CreateInviteForm } from "@/components/auth/create-invite-form";
import { InvitesTable } from "@/components/auth/invites-table";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

// Admin-only; reads the session + DB, so always rendered per-request.
export default async function AdminInvitesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Security boundary: only invite-managers may see or use this page.
  await requirePermission("invites:manage", locale);

  const t = await getTranslations({ locale, namespace: "auth" });
  const invites = await listInvites();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("invitesTitle")}</CardTitle>
          <CardDescription>{t("invitesSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateInviteForm />
        </CardContent>
      </Card>
      <InvitesTable invites={invites} locale={locale} />
    </div>
  );
}
