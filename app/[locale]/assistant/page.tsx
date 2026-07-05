import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getAiCredential } from "@/lib/ai/credentials";
import { QUOTE_HISTORY_VIEW_COOKIE } from "@/lib/ai/constants";
import { listSavedQuotes } from "@/lib/ai/quotes";
import { ChatInterface } from "@/components/ai/chat-interface";
import { QuoteHistory } from "@/components/ai/quote-history";
import { AiEnabledSync } from "@/components/ai/ai-enabled-sync";

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);

  // Hidden until a key exists (contract §Access): bounce to the settings tab.
  const credential = await getAiCredential();
  if (!credential) redirect(`/${locale}/account/ai`);

  const quotes = await listSavedQuotes(user.id);
  const historyView =
    (await cookies()).get(QUOTE_HISTORY_VIEW_COOKIE)?.value === "drawer" ? "drawer" : "list";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <AiEnabledSync enabled />
      {/* Ephemeral scratchpad — nothing persists until a quote is saved. */}
      <ChatInterface />
      <QuoteHistory locale={locale} quotes={quotes} initialView={historyView} />
    </div>
  );
}
