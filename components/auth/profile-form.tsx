"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useSuccessToast } from "@/hooks/use-success-toast";
import { updateProfile, type AuthState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ProfileForm({
  locale,
  defaultDisplayName,
}: {
  locale: string;
  defaultDisplayName: string;
}) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    updateProfile.bind(null, locale),
    {},
  );
  useSuccessToast(state, t("saved"), "profile-saved");

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">{t("displayName")}</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={defaultDisplayName}
          maxLength={80}
          placeholder={t("displayNamePlaceholder")}
          className="max-w-xs"
        />
      </div>
      {state.ok && <p className="text-sm text-success">{t("saved")}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
