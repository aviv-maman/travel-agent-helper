"use client";

import { useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, Scale, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cancellationDeadline, formatDeadline } from "@/lib/consumer-law";
import { todayInJerusalem } from "@/lib/dashboard/dates";
import { DatePicker } from "@/components/ui/date-picker";

/** Today's date has no change events worth tracking within a single session. */
function subscribeToNothing() {
  return () => undefined;
}

const REASON_KEY = {
  fourteenDays: "calcBy14",
  businessDays: "calcBy7",
} as const;

/**
 * Works out the last day a customer may cancel under the Consumer Protection
 * Law: within 14 days of booking, and while more than 7 business days remain
 * before departure — whichever runs out first. The rules live in
 * lib/consumer-law.ts (pure + unit-tested); this is only the form around them.
 */
export function LawCalculator() {
  const t = useTranslations("cancellations");
  const locale = useLocale();
  const [edited, setEdited] = useState<string | null>(null);
  const [departure, setDeparture] = useState("");
  const [copied, setCopied] = useState(false);

  // Read as a client-only value on purpose: the page is statically rendered per
  // locale (setRequestLocale), so a "today" resolved during render would freeze
  // at build time and hand the agent a stale default date. The server snapshot
  // is empty and the real Jerusalem date lands at hydration.
  const today = useSyncExternalStore(subscribeToNothing, todayInJerusalem, () => "");
  // Clearing the field leaves "" (not null), which the calculator reads as
  // "no booking date given" and falls back to today — as the rules specify.
  const booking = edited ?? today;

  const result = departure ? cancellationDeadline(departure, booking) : null;
  // "none" = the >7-business-days rule is already unmet on the booking day, so
  // the booking is not cancelable under the law at all (not "booking day only").
  const notEligible = result?.limitedBy === "none";
  const answer = !result
    ? ""
    : notEligible
      ? t("calcNotEligible")
      : `${t("calcResult")} ${formatDeadline(result.deadline!)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("copy"));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand/25 bg-brand/5 p-3">
      <p className="mb-0! flex items-center gap-1.5 text-xs font-bold tracking-wide text-brand uppercase">
        <Scale className="size-3.5 shrink-0" aria-hidden />
        {t("calcTitle")}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-36 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("calcBooking")}</span>
          <DatePicker
            value={booking}
            max={departure || undefined}
            locale={locale}
            ariaLabel={t("calcBooking")}
            onChange={setEdited}
            className="w-full"
          />
        </label>
        <label className="flex min-w-36 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("calcDeparture")}</span>
          <DatePicker
            value={departure}
            min={booking || undefined}
            locale={locale}
            placeholder={t("calcDeparturePlaceholder")}
            ariaLabel={t("calcDeparture")}
            onChange={setDeparture}
            className="w-full"
          />
        </label>
      </div>

      {!departure ? (
        <p className="mb-0! text-xs text-muted-foreground">{t("calcEmpty")}</p>
      ) : !result ? (
        <p className="mb-0! flex items-center gap-1.5 text-xs font-semibold text-destructive">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          {t("calcInvalid")}
        </p>
      ) : notEligible ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand/20 pt-2.5">
          <p className="mb-0! flex items-center gap-1.5 text-sm font-bold text-destructive">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {t("calcNotEligible")}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
              copied
                ? "border-success/40 bg-success/15 text-success"
                : "border-border bg-surface-2 text-muted-foreground hover:border-brand/40 hover:text-brand"
            }`}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 border-t border-brand/20 pt-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="mb-0! text-sm font-bold text-success">
              {t("calcResult")}{" "}
              <span dir="ltr" className="tabular-nums">
                {formatDeadline(result.deadline!)}
              </span>
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                copied
                  ? "border-success/40 bg-success/15 text-success"
                  : "border-border bg-surface-2 text-muted-foreground hover:border-brand/40 hover:text-brand"
              }`}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <p className="mb-0! text-xs text-muted-foreground">
            {t(REASON_KEY[result.limitedBy as keyof typeof REASON_KEY])}
          </p>
        </div>
      )}
    </div>
  );
}
