"use client";

import { useTranslations } from "next-intl";
import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  return (
    <form action={logout.bind(null, locale)}>
      <Button type="submit" variant="outline">
        {t("signOut")}
      </Button>
    </form>
  );
}
