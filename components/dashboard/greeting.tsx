"use client";

import { useLocale, useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import type { GreetingKey } from "@/lib/dashboard/dates";

/** Time-of-day greeting with the agent's name, like an AI assistant home. */
export function Greeting({ name, greeting }: { name: string; greeting: GreetingKey }) {
  const t = useTranslations("dashboard.greeting");
  const locale = useLocale();
  const today = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-brand/10 via-surface to-purple/10 px-5 py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-10 -top-16 size-40 rounded-full bg-brand/20 blur-3xl"
      />
      <div className="relative flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Sparkles className="size-3.5 text-brand" aria-hidden />
          {today}
        </span>
        <h1 className="bg-gradient-to-r from-brand to-purple bg-clip-text text-2xl font-extrabold text-transparent sm:text-3xl">
          {t(greeting)}, {name}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
    </div>
  );
}
