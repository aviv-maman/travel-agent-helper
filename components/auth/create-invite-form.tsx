"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { useSuccessToast } from "@/hooks/use-success-toast";
import { createInvite, type InviteState } from "@/lib/auth/actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLES = ["agent", "editor", "admin"] as const;

export function CreateInviteForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, {});
  // The app Select is a controlled component; a hidden input carries the value
  // into the server action's FormData.
  const [role, setRole] = useState<string>("agent");
  useSuccessToast(state, t("toastInviteCreated"), "invite-created");

  const roleLabels = Object.fromEntries(ROLES.map((r) => [r, t(`roles.${r}`)]));

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role">{t("role")}</Label>
        {/* App Select (themed DOM popup) rather than a native <select>, whose
            option list rendered white-on-white in dark mode. */}
        <input type="hidden" name="role" value={role} />
        <Select value={role} onValueChange={(v) => setRole(v as string)} items={roleLabels}>
          <SelectTrigger id="role" className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`roles.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
