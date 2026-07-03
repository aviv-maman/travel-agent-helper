"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setPassword, type AuthState } from "@/lib/auth/actions";
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
    default:
      return t("errInvalid");
  }
}

/** Lets an OAuth-only user (no password) set one, so they can also password-login. */
export function SetPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    setPassword.bind(null, locale),
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
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
      {state.ok && <p className="text-sm text-success">{t("passwordSet")}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("updating") : t("setPasswordCta")}
      </Button>
    </form>
  );
}
