"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Pencil, Check, X, Landmark } from "lucide-react";
import { BANK_KEYS, hasBankDetails, type BankDetails, type BankKey } from "@/lib/dashboard/bank";
import { saveBankDetailsAction } from "@/app/actions/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Bank-transfer details with a one-tap copy that yields a ready-to-paste Hebrew
 * WhatsApp block, plus inline edit persisted to the `dashboard_settings` table.
 */
export function BankDetailsCard({ bank }: { bank: BankDetails }) {
  const t = useTranslations("dashboard.bank");
  const tRoot = useTranslations("dashboard");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BankDetails>(bank);
  const [pending, startTransition] = useTransition();

  const hasDetails = hasBankDetails(bank);

  function copy() {
    const lines = [t("copyHeading")];
    for (const key of BANK_KEYS) {
      const value = bank[key]?.trim();
      if (value) lines.push(`${t(key)}: ${value}`);
    }
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => toast.success(t("copied")),
      () => toast.error(t("copied")),
    );
  }

  /** Copy a single field's value (e.g. just the account number). */
  function copyField(key: BankKey) {
    const value = bank[key]?.trim();
    if (!value) return;
    navigator.clipboard.writeText(value).then(
      () => toast.success(t("copied")),
      () => toast.error(t("copied")),
    );
  }

  function save() {
    startTransition(async () => {
      const res = await saveBankDetailsAction(draft);
      if ("error" in res) {
        toast.error(tRoot("offline"));
        return;
      }
      toast.success(tRoot("toasts.saved"));
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setDraft(bank);
    setEditing(false);
  }

  return (
    <Card size="sm" className="mx-auto w-full max-w-sm gap-3">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight text-foreground">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 ring-1 ring-brand/15"
              aria-hidden>
              <Landmark className="size-4 text-brand" />
            </span>
            {t("title")}
          </h2>
          {!editing && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("edit")}
              onClick={() => {
                setDraft(bank);
                setEditing(true);
              }}>
              <Pencil className="size-4" />
            </Button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2.5">
            {BANK_KEYS.map((key) => (
              <div key={key} className="grid gap-1">
                <Label htmlFor={`bank-${key}`} className="text-xs text-muted-foreground">
                  {t(key)}
                </Label>
                <Input
                  id={`bank-${key}`}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  disabled={pending}
                />
              </div>
            ))}
            <div className="mt-1 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancel} disabled={pending}>
                <X className="size-4" /> {t("cancel")}
              </Button>
              <Button size="sm" onClick={save} disabled={pending}>
                <Check className="size-4" /> {t("save")}
              </Button>
            </div>
          </div>
        ) : hasDetails ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 text-sm">
              {BANK_KEYS.map((key) =>
                bank[key]?.trim() ? (
                  <div key={key} className="contents">
                    <dt className="text-muted-foreground">{t(key)}</dt>
                    <dd>
                      {/* Each value is click-to-copy, so the account/branch
                          numbers can be grabbed individually. */}
                      <button
                        type="button"
                        onClick={() => copyField(key)}
                        aria-label={`${t("copy")}: ${bank[key]}`}
                        className="group -mx-2 flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-start font-medium text-foreground transition-colors hover:bg-muted/60">
                        <span className="truncate">{bank[key]}</span>
                        <Copy className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                      </button>
                    </dd>
                  </div>
                ) : null,
              )}
            </dl>
            <Button size="sm" className="w-full" onClick={copy}>
              <Copy className="size-4" /> {t("copy")}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
      </CardContent>
    </Card>
  );
}
