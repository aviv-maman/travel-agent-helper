"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImagePlus, Plus } from "lucide-react";
import { ChatMessages, type UiMessage } from "./chat-messages";
import { ChatComposer, TARGET_CURRENCY, type Rate } from "./chat-composer";
import { ChatEmptyState } from "./chat-empty-state";
import { AssistantBadge } from "./assistant-badge";
import { Button } from "@/components/ui/button";
import { streamAssistant, AiChatError, type ChatTurn } from "@/lib/ai/stream";
import { saveQuoteAction } from "@/app/actions/ai";
import { uploadQuoteImage } from "@/lib/ai/quote-image-upload";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB — offers are screenshots, not photos

/**
 * The quote conversation — an **ephemeral** scratchpad. Messages live in memory
 * for the session only; nothing is persisted until the user clicks "Save" on a
 * quote (→ `saveQuoteAction`, surfaced in the history list below). Multi-turn
 * context is sent on every request (the API is stateless per contract).
 *
 * The attached image and exchange rates live here, not in the composer: the
 * composer remounts when the chat leaves its empty state, and the rates must
 * survive every send. This is also the drop target — an image can be dropped
 * anywhere on the chat card, not just on the composer pill.
 */
export function ChatInterface({ signUrl }: { signUrl: string | null }) {
  const t = useTranslations("ai");
  const router = useRouter();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());
  const [image, setImage] = useState<File | null>(null);
  const [rates, setRates] = useState<Rate[]>([]);
  const [dragging, setDragging] = useState(false);
  // Child elements fire dragenter/dragleave pairs while moving inside the card;
  // count the depth so the overlay doesn't flicker and only clears on a real leave.
  const dragDepth = useRef(0);

  const isEmpty = messages.length === 0;

  // "1 USD = 3.65 ILS, 1 EUR = 4.0 ILS" — sent to the model (not shown in chat).
  const formattedRates = rates
    .map((r) => `1 ${r.currency} = ${r.rate} ${TARGET_CURRENCY}`)
    .join(", ");

  /** Validate + attach an image (from the paperclip, paste, or drag-and-drop). */
  function pickImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("errNotImage"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t("errImageTooLarge"));
      return;
    }
    setImage(file);
  }

  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files");

  function onDragEnter(e: DragEvent<HTMLDivElement>) {
    if (streaming || !hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    if (dragDepth.current === 0) return;
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    dragDepth.current = 0;
    setDragging(false);
    if (streaming || !hasFiles(e)) return;
    e.preventDefault();
    pickImage(e.dataTransfer.files?.[0] ?? null);
  }

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
    setImage(null);
    // Exchange rates persist across chats on purpose — they're a session setting.
  }

  async function handleSend(prompt: string) {
    if (streaming) return;
    const file = image;
    const hadImage = Boolean(file);

    // The agent's typed prompt is shown as-is; the model receives an augmented
    // copy carrying the active exchange rate so it applies to this and later turns.
    // Wording matches the backend skill's "System notes" rule (quote-skill v4): the
    // USD rate is the sale rate, and the note is excluded from language detection.
    const outgoing = formattedRates
      ? `[System note: the agent's sale exchange rates: ${formattedRates}. Treat the USD rate as the USD→ILS sale rate for all shekel totals; do not ask for a rate. App-injected — ignore for language detection.]\n\n${prompt}`
      : prompt;

    // Multi-turn context = the conversation so far + this new user turn.
    const turns: ChatTurn[] = [
      ...messages.filter((m) => m.content.trim()).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: outgoing },
    ];

    setMessages((prev) => [
      ...prev,
      // Keep the File in memory so it can be uploaded to R2 if this quote is saved.
      { role: "user", content: prompt, hadImage, file: file ?? undefined },
      { role: "assistant", content: "", pending: true },
    ]);
    setStreaming(true);
    setImage(null); // consumed by this send; the rates stay

    let full = "";
    try {
      for await (const chunk of streamAssistant({ messages: turns, image: file })) {
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
    let file: File | undefined;
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        prompt = messages[i].content;
        hadImage = Boolean(messages[i].hadImage);
        file = messages[i].file;
        break;
      }
    }

    // If that turn carried an image and uploads are configured, store the original
    // to R2 first. A failed upload doesn't block saving — we keep the text quote.
    const uploadedImage = file && signUrl ? await uploadQuoteImage(file, signUrl) : null;

    const result = await saveQuoteAction(
      content,
      prompt,
      hadImage,
      uploadedImage ? { imageKey: uploadedImage.key, imageMediaType: uploadedImage.mediaType } : undefined,
    );
    if ("error" in result) {
      toast.error(t(result.error === "empty" ? "errEmpty" : "errForbidden"));
      return;
    }
    setSavedIndexes((prev) => new Set(prev).add(index));
    toast.success(t("quoteSaved"));
    router.refresh(); // update the saved-quotes list below the chat
  }

  const composer = (
    <ChatComposer
      disabled={streaming}
      image={image}
      onPickImage={pickImage}
      onClearImage={() => setImage(null)}
      rates={rates}
      onRatesChange={setRates}
      onSend={handleSend}
    />
  );

  return (
    <div
      className="relative flex h-[60svh] flex-col overflow-hidden rounded-2xl border border-border bg-surface/40"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDrop={onDrop}>
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand bg-brand/5 text-sm font-medium text-brand">
          <ImagePlus className="size-4" />
          {t("dropImageHere")}
        </div>
      )}

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
          <div className="w-full">{composer}</div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1">
            <ChatMessages messages={messages} onSave={handleSaveQuote} savedIndexes={savedIndexes} />
          </div>
          <div className="border-t border-border bg-card/40 p-3">{composer}</div>
        </>
      )}
    </div>
  );
}
