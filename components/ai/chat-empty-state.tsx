"use client";

import { useTranslations } from "next-intl";
import { ImagePlus, MessageSquareText, Percent, type LucideIcon } from "lucide-react";
import { AssistantBadge } from "./assistant-badge";

type Example = {
  icon: LucideIcon;
  titleKey: "suggestExtractTitle" | "suggestWhatsappTitle" | "suggestConvertTitle";
  promptKey: "suggestExtractPrompt" | "suggestWhatsappPrompt" | "suggestConvertPrompt";
};

const EXAMPLES: Example[] = [
  { icon: ImagePlus, titleKey: "suggestExtractTitle", promptKey: "suggestExtractPrompt" },
  { icon: MessageSquareText, titleKey: "suggestWhatsappTitle", promptKey: "suggestWhatsappPrompt" },
  { icon: Percent, titleKey: "suggestConvertTitle", promptKey: "suggestConvertPrompt" },
];

/** Hero shown before the first message: branded badge, greeting, and static
 * example cards (display-only — not clickable). */
export function ChatEmptyState() {
  const t = useTranslations("ai");

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-5 text-center">
      <div className="flex flex-col items-center gap-3">
        <AssistantBadge className="size-11 [&_svg]:size-5" />
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
            {t("greetingTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("greetingSubtitle")}</p>
        </div>
      </div>

      <div className="grid w-full gap-2 sm:grid-cols-3">
        {EXAMPLES.map(({ icon: Icon, titleKey, promptKey }) => (
          <div
            key={titleKey}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3 text-start">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="size-4" />
            </span>
            <span className="text-sm font-medium text-foreground">{t(titleKey)}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{t(promptKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
