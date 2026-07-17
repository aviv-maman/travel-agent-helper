import { setRequestLocale, getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth";
import { listUsers } from "@/lib/auth/users";
import { UsersTable } from "@/components/auth/users-table";
import { Link } from "@/i18n/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function asString(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function AccountUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requirePermission("users:manage", locale);

  const t = await getTranslations({ locale, namespace: "auth" });
  const tA = await getTranslations({ locale, namespace: "account" });

  const sp = await searchParams;
  const q = asString(sp.q);
  const page = Math.max(1, Number(asString(sp.page)) || 1);
  const { rows, total, pageCount } = await listUsers({ search: q, page });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("usersTitle")}</CardTitle>
          <CardDescription>{t("usersSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {/* GET form → ?q=…; omitting page resets to the first page. */}
          <form className="flex gap-2">
            <Input name="q" defaultValue={q} placeholder={tA("searchUsers")} className="max-w-xs" />
            <Button type="submit" variant="outline">
              {tA("search")}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">{tA("usersCount", { total })}</p>
        </CardContent>
      </Card>

      <UsersTable users={rows} currentUserId={me.id} locale={locale} />

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{tA("pageOf", { page, pageCount })}</span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={{ pathname: "/account/admin/users", query: { q, page: page - 1 } }}
                className="rounded-md border border-border px-3 py-1 text-muted-foreground hover:text-foreground">
                {tA("prev")}
              </Link>
            ) : (
              <span className="rounded-md border border-border px-3 py-1 text-muted-foreground/40">
                {tA("prev")}
              </span>
            )}
            {page < pageCount ? (
              <Link
                href={{ pathname: "/account/admin/users", query: { q, page: page + 1 } }}
                className="rounded-md border border-border px-3 py-1 text-muted-foreground hover:text-foreground">
                {tA("next")}
              </Link>
            ) : (
              <span className="rounded-md border border-border px-3 py-1 text-muted-foreground/40">
                {tA("next")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
