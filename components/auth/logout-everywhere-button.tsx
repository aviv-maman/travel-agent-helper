"use client";

import { useTranslations } from "next-intl";
import { logoutEverywhere } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function LogoutEverywhereButton({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  return (
    <form
      action={logoutEverywhere.bind(null, locale)}
      onSubmit={(e) => {
        if (!window.confirm(t("logoutAllConfirm"))) e.preventDefault();
      }}>
      <Button type="submit" variant="outline">
        {t("logoutEverywhere")}
      </Button>
    </form>
  );
}
