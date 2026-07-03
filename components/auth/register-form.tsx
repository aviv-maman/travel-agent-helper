"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { register, type AuthState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type T = ReturnType<typeof useTranslations<"auth">>;

/** Map an action error code to its message (literal keys keep next-intl type-safe). */
function errorMessage(t: T, error: string): string {
  switch (error) {
    case "codeMissing":
      return t("errCodeMissing");
    case "codeInvalid":
      return t("errCodeInvalid");
    case "usernameShort":
      return t("errUsernameShort");
    case "usernameChars":
      return t("errUsernameChars");
    case "usernameTaken":
      return t("errUsernameTaken");
    case "passwordShort":
      return t("errPasswordShort");
    default:
      return t("errInvalid");
  }
}

export function RegisterForm({
  locale,
  defaultCode = "",
}: {
  locale: string;
  defaultCode?: string;
}) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    register.bind(null, locale),
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">{t("code")}</Label>
        <Input id="code" name="code" defaultValue={defaultCode} required autoFocus={!defaultCode} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">{t("username")}</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus={!!defaultCode}
          required
        />
        <p className="text-xs text-muted-foreground">{t("usernameHint")}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
      </div>
      {state.error && (
        <p className="text-sm text-destructive">{errorMessage(t, state.error)}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("registering") : t("registerCta")}
      </Button>
    </form>
  );
}
