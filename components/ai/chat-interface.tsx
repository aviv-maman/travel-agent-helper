"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ChatMessages, type UiMessage } from "./chat-messages";
import { ChatComposer } from "./chat-composer";
import { ChatEmptyState } from "./chat-empty-state";
import { AssistantBadge } from "./assistant-badge";
import { Button } from "@/components/ui/button";
import { streamAssistant, AiChatError, type ChatTurn } from "@/lib/ai/stream";
import { saveQuoteAction } from "@/app/actions/ai";

/**
 * The quote conversation — an **ephemeral** scratchpad. Messages live in memory
 * for the session only; nothing is persisted until the user clicks "Save" on a
 * quote (→ `saveQuoteAction`, surfaced in the history list below). Multi-turn
 * context is sent on every request (the API is stateless per contract).
 */
export function ChatInterface() {
  const t = useTranslations("ai");
  const router = useRouter();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());

  const isEmpty = messages.length === 0;

  function setLastAssistant(content: string, pending: boolean) {
    setMessages((prev) => {
      const next = [...prev];
      next[next.length - 1] = { role: "assistant", content, pending };
      return next;
    });
  }

  function handleNewChat() {
    setMessages([]);
    setSavedIndexes(new Set());
    setStreaming(false);
  }

  async function handleSend(prompt: string, image: File | null, exchangeRate: string) {
    if (streaming) return;
    const hadImage = Boolean(image);

    // The agent's typed prompt is shown as-is; the model receives an augmented
    // copy carrying the active exchange rate so it applies to this and later turns.
    const outgoing = exchangeRate
      ? `[Use these exchange rates for any currency conversions: ${exchangeRate}]\n\n${prompt}`
      : prompt;

    // Multi-turn context = the conversation so far + this new user turn.
    const turns: ChatTurn[] = [
      ...messages.filter((m) => m.content.trim()).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: outgoing },
    ];

    setMessages((prev) => [
      ...prev,
      { role: "user", content: prompt, hadImage },
      { role: "assistant", content: "", pending: true },
    ]);
    setStreaming(true);

    let full = "";
    try {
      for await (const chunk of streamAssistant({ messages: turns, image })) {
        full += chunk;
        setLastAssistant(full, true);
      }
    } catch (err) {
      const message =
        err instanceof AiChatError && err.status === 401
          ? t("errChat401")
          : err instanceof AiChatError && err.status === 429
            ? t("errRateLimited")
            : t("errChatGeneric");
      toast.error(message);
      if (!full) full = message;
    }

    setLastAssistant(full, false);
    setStreaming(false);
  }

  async function handleSaveQuote(index: number) {
    const content = messages[index]?.content ?? "";
    if (!content.trim() || savedIndexes.has(index)) return;
    // The nearest preceding user turn is the request that produced this quote.
    let prompt = "";
    let hadImage = false;
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        prompt = messages[i].content;
        hadImage = Boolean(messages[i].hadImage);
        break;
      }
    }

    const result = await saveQuoteAction(content, prompt, hadImage);
    if ("error" in result) {
      toast.error(t(result.error === "empty" ? "errEmpty" : "errForbidden"));
      return;
    }
    setSavedIndexes((prev) => new Set(prev).add(index));
    toast.success(t("quoteSaved"));
    router.refresh(); // update the saved-quotes list below the chat
  }

  return (
    <div className="flex h-[60svh] flex-col overflow-hidden rounded-2xl border border-border bg-surface/40">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <AssistantBadge className="size-7 [&_svg]:size-3.5" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">{t("title")}</span>
            <span className="text-[0.7rem] text-muted-foreground">{t("poweredBy")}</span>
          </div>
        </div>
        {!isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleNewChat}
            disabled={streaming}>
            <Plus className="size-4" />
            {t("newChat")}
          </Button>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-1 flex-col p-3">
          <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-4">
            <ChatEmptyState />
          </div>
          <div className="w-full">
            <ChatComposer disabled={streaming} onSend={handleSend} />
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1">
            <ChatMessages messages={messages} onSave={handleSaveQuote} savedIndexes={savedIndexes} />
          </div>
          <div className="border-t border-border bg-card/40 p-3">
            <ChatComposer disabled={streaming} onSend={handleSend} />
          </div>
        </>
      )}
    </div>
  );
}
