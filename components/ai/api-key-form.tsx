"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound, Trash2 } from "lucide-react";
import { saveAiKey, deleteAiKey, type KeyFormState } from "@/app/actions/ai";
import { setAiEnabled } from "@/lib/ai/ai-enabled-store";
import type { AiCredential } from "@/lib/ai/credentials";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type T = ReturnType<typeof useTranslations<"ai">>;

function keyError(t: T, error: NonNullable<KeyFormState["error"]>): string {
  switch (error) {
    case "empty":
      return t("errEmpty");
    case "invalidKey":
      return t("errInvalidKey");
    case "rateLimited":
      return t("errRateLimited");
    case "forbidden":
      return t("errForbidden");
    default:
      return t("errBackend");
  }
}

/**
 * BYO Anthropic key: enter → validate/store (via backend or local mock), then
 * show `••••last4` with Rotate / Delete. The plaintext key never round-trips back
 * to the client. `demo` = no backend wired yet (local mock).
 */
export function ApiKeyForm({
  locale,
  credential,
  demo,
}: {
  locale: string;
  credential: AiCredential | null;
  demo: boolean;
}) {
  const t = useTranslations("ai");
  const router = useRouter();
  const [error, setError] = useState<KeyFormState["error"] | null>(null);
  const [savedLast4, setSavedLast4] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  // Prefer the just-saved value; fall back to the server credential unless we
  // just deleted it (the prop refreshes a beat later via router.refresh()).
  const last4 = savedLast4 ?? (removed ? null : (credential?.last4 ?? null));
  const showForm = last4 === null || rotating;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startSave(async () => {
      const res = await saveAiKey(locale, {}, formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSavedLast4(res.last4 ?? null);
      setRemoved(false);
      setRotating(false);
      setAiEnabled(true);
      toast.success(t("keySaved"));
      router.refresh();
    });
  }

  function onDelete() {
    startDelete(async () => {
      try {
        await deleteAiKey(locale);
      } catch {
        toast.error(t("keyDeleteError"));
        return;
      }
      setSavedLast4(null);
      setRemoved(true);
      setRotating(false);
      setConfirmOpen(false);
      setAiEnabled(false);
      toast.success(t("keyRemoved"));
      router.refresh();
    });
  }

  if (!showForm && last4) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">
            <KeyRound className="size-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{t("providerAnthropic")}</span>
            <span className="font-mono text-muted-foreground" dir="ltr">
              ••••{last4}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRotating(true)}>
              {t("rotate")}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("delete")}
              onClick={() => setConfirmOpen(true)}>
              <Trash2 className="text-destructive" />
            </Button>
          </div>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onDelete} disabled={deleting}>
                {deleting ? <Spinner /> : t("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="apiKey">{t("apiKeyLabel")}</Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder="sk-ant-…"
          dir="ltr"
          required
        />
        <p className="text-xs text-muted-foreground">{t("apiKeyHint")}</p>
      </div>
      {error && <p className="text-sm text-destructive">{keyError(t, error)}</p>}
      {demo && <p className="text-xs text-muted-foreground">{t("demoNote")}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving} className="self-start">
          {saving ? <Spinner /> : null}
          {saving ? t("validating") : last4 ? t("saveNewKey") : t("saveKey")}
        </Button>
        {last4 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => setRotating(false)}>
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
