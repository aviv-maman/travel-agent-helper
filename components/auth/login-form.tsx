"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { login, type AuthState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  // Bind the locale so the action's redirect stays on the active language.
  const [state, action, pending] = useActionState<AuthState, FormData>(
    login.bind(null, locale),
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">{t("username")}</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && (
        <p className="text-sm text-destructive">
          {state.error === "missing"
            ? t("errMissing")
            : state.error === "locked"
              ? t("errLocked")
              : t("errInvalid")}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </Button>
    </form>
  );
}
