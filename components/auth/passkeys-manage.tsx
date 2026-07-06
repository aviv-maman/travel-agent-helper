"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { toast } from "sonner";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import {
  passkeyRegistrationOptions,
  passkeyRegistrationVerify,
  deletePasskeyAction,
} from "@/lib/auth/passkey-actions";

export type PasskeyRow = {
  id: string;
  deviceName: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
};

/**
 * The Passkeys card on Account → Security: list the user's registered
 * passkeys, add a new one (WebAuthn registration ceremony in the browser),
 * delete existing ones. The ceremony needs `navigator.credentials`, so this is
 * a Client Component; verification happens server-side.
 */
export function PasskeysManage({ passkeys }: { passkeys: PasskeyRow[] }) {
  const t = useTranslations("auth");
  const format = useFormatter();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    setBusy(true);
    try {
      const opts = await passkeyRegistrationOptions();
      if ("error" in opts) {
        toast.error(t("passkeyError"));
        return;
      }
      const response = await startRegistration({ optionsJSON: opts.options });
      const result = await passkeyRegistrationVerify(response);
      if (result.ok) {
        toast.success(t("passkeyAdded"));
        router.refresh();
      } else {
        toast.error(t("passkeyError"));
      }
    } catch (err) {
      // The user closing the OS prompt raises NotAllowedError — not an error state.
      if (!(err instanceof Error && err.name === "NotAllowedError")) {
        toast.error(t("passkeyError"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    await deletePasskeyAction(id);
    toast.success(t("passkeyDeleted"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {passkeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noPasskeys")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-3">
                <KeyRound className="size-4 text-muted-foreground" />
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-medium">{pk.deviceName ?? t("passkeyGeneric")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("passkeyCreated", { date: format.dateTime(pk.createdAt, { dateStyle: "medium" }) })}
                    {" · "}
                    {pk.lastUsedAt
                      ? t("passkeyLastUsed", {
                          date: format.dateTime(pk.lastUsedAt, { dateStyle: "medium" }),
                        })
                      : t("passkeyNeverUsed")}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("passkeyDelete")}
                onClick={() => handleDelete(pk.id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="outline" size="sm" onClick={handleAdd} disabled={busy}>
          <Plus className="size-4" />
          {t("addPasskey")}
        </Button>
      </div>
    </div>
  );
}
