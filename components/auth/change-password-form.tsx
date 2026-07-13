"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useSuccessToast } from "@/hooks/use-success-toast";
import { changePassword, type AuthState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type T = ReturnType<typeof useTranslations<"auth">>;

function errorMessage(t: T, error: string): string {
  switch (error) {
    case "passwordShort":
      return t("errPasswordShort");
    case "passwordMismatch":
      return t("errPasswordMismatch");
    case "wrongPassword":
      return t("errWrongPassword");
    default:
      return t("errInvalid");
  }
}

export function ChangePasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    changePassword.bind(null, locale),
    {},
  );
  useSuccessToast(state, t("passwordUpdated"), "password-changed");

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">{t("newPassword")}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{errorMessage(t, state.error)}</p>}
      {state.ok && <p className="text-sm text-success">{t("passwordUpdated")}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("updating") : t("updatePassword")}
      </Button>
    </form>
  );
}
