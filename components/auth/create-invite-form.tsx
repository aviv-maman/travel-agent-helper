"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createInvite, type InviteState } from "@/lib/auth/actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateInviteForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role">{t("role")}</Label>
        <select
          id="role"
          name="role"
          defaultValue="agent"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
          <option value="agent">{t("roles.agent")}</option>
          <option value="editor">{t("roles.editor")}</option>
          <option value="admin">{t("roles.admin")}</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expiresInDays">{t("expiresInDays")}</Label>
        <Input
          id="expiresInDays"
          name="expiresInDays"
          type="number"
          min={1}
          placeholder={t("noExpiry")}
          className="w-36"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t("generating") : t("generate")}
      </Button>
      {state.error && (
        <p className="w-full text-sm text-destructive">
          {t(state.error === "forbidden" ? "errForbidden" : "errInvalid")}
        </p>
      )}
    </form>
  );
}
