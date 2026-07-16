"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, X } from "lucide-react";
import { reauthWithPassword, reauthWithTotp } from "@/lib/auth/reauth-actions";
import type { ReauthState } from "@/lib/auth/reauth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ReauthDialog({
  open,
  onOpenChange,
  onSuccess,
  hasPassword,
  has2fa,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  hasPassword: boolean;
  has2fa: boolean;
}) {
  const t = useTranslations("auth");
  const [passwordState, passwordAction, passwordPending] = useActionState(
    reauthWithPassword,
    {},
  );
  const [totpState, totpAction, totpPending] = useActionState(reauthWithTotp, {});

  const isPending = passwordPending || totpPending;

  if (passwordState.ok || totpState.ok) {
    onSuccess();
    onOpenChange(false);
  }

  const errorMsg = passwordState.error || totpState.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("reauthTitle")}</DialogTitle>
          <DialogDescription>{t("reauthDescription")}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={hasPassword ? "password" : "2fa"} className="w-full">
          {hasPassword && has2fa && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">{t("password")}</TabsTrigger>
              <TabsTrigger value="2fa">2FA</TabsTrigger>
            </TabsList>
          )}

          {hasPassword && (
            <TabsContent value="password" className="space-y-4">
              <form action={passwordAction} className="space-y-4">
                <Input
                  type="password"
                  name="password"
                  placeholder={t("password")}
                  disabled={isPending}
                  autoComplete="current-password"
                  required
                />
                {errorMsg === "invalid_password" && (
                  <p className="text-sm text-destructive">{t("wrongPassword")}</p>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}
                    {t("reauthVerify")}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          )}

          {has2fa && (
            <TabsContent value="2fa" className="space-y-4">
              <form action={totpAction} className="space-y-4">
                <Input
                  type="text"
                  name="code"
                  placeholder="000000"
                  disabled={isPending}
                  autoComplete="off"
                  inputMode="numeric"
                  required
                />
                {errorMsg === "invalid_code" && (
                  <p className="text-sm text-destructive">{t("invalidCode")}</p>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}
                    {t("reauthVerify")}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          )}

          {!hasPassword && !has2fa && (
            <div className="space-y-4 py-4 text-center text-sm text-muted-foreground">
              <p>{t("reauthNoMethod")}</p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
            </div>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
