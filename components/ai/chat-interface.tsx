"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
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
import { onQuoteDeleted } from "@/lib/ai/quote-events";
import { uploadQuoteImage } from "@/lib/ai/quote-image-upload";
import { loadRates, storeRates } from "@/lib/ai/rates-store";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB — offers are screenshots, not photos

/**
 * Vision tokens scale with pixels, and current Claude models accept screenshots at
 * full resolution — a 2560px display capture costs ~4–5K tokens per request round.
 * 1568px is the classic Claude vision resolution, so capping there keeps small
 * digits perfectly legible while cutting the image to ~1.2K tokens.
 */
const MAX_IMAGE_EDGE = 1568;

/** Downscale oversized screenshots to MAX_IMAGE_EDGE (JPEG); falls back to the original. */
async function downscaleImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longEdge = Math.max(width, height);
    if (longEdge <= MAX_IMAGE_EDGE) {
      bitmap.close();
      return file;
    }
    const scale = MAX_IMAGE_EDGE / longEdge;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.\w+$/, "") || "screenshot";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file; // decode/canvas failure — send the original as before
  }
}

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
  // Message index → the saved quote's DB id. A map (not a Set) so that when the
  // history deletes a quote we can find and RE-ENABLE its "Save" button.
  const [savedIds, setSavedIds] = useState<Map<number, number>>(new Map());
  const [image, setImage] = useState<File | null>(null);
  // The attached image is uploaded to storage EAGERLY (on attach, not on save) so
  // the composer can show real progress and saving is instant. `imageKey` is the
  // uploaded object's key (null while uploading / on failure — save falls back to
  // uploading then). `uploadSeq` guards against a stale completion overwriting the
  // state after the user swapped or cleared the image mid-flight.
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const uploadSeq = useRef(0);
  // The conversation's screenshot. The API is stateless (multi-turn context is resent
  // every request) and the backend attaches the image to the LATEST user turn — so to
  // keep vision context on follow-ups ("make it 10% more") we must resend the image
  // with every later send, not just the turn that attached it.
  const [sentImage, setSentImage] = useState<File | null>(null);
  // Rates survive leaving the page: hydrated from localStorage after mount
  // (SSR renders them unset) and written back on every change. The store
  // drops entries older than half a day — sale rates are a daily setting.
  const [rates, setRates] = useState<Rate[]>([]);
  useEffect(() => {
    // One-time client hydration from a browser-only source (localStorage): the
    // server must render "no rates" deterministically, so the read happens
    // after mount. The extra render is bounded (mount only).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRates(loadRates());
  }, []);
  function handleRatesChange(next: Rate[]) {
    setRates(next);
    storeRates(next);
  }
  const [dragging, setDragging] = useState(false);
  // Child elements fire dragenter/dragleave pairs while moving inside the card;
  // count the depth so the overlay doesn't flicker and only clears on a real leave.
  const dragDepth = useRef(0);

  const isEmpty = messages.length === 0;

  // History deleted a quote → re-enable "Save" on the reply that produced it, and
  // strip the freed imageKey from the attaching message (the object is gone from
  // storage, so a re-save must re-upload from the in-memory File).
  useEffect(() => {
    return onQuoteDeleted(({ id, imageKey }) => {
      setSavedIds((prev) => {
        if (![...prev.values()].includes(id)) return prev;
        return new Map([...prev].filter(([, quoteId]) => quoteId !== id));
      });
      if (imageKey && imageKey !== "mock") {
        setMessages((prev) =>
          prev.map((m) =>
            m.imageKey === imageKey ? { ...m, imageKey: undefined, imageMediaType: undefined } : m,
          ),
        );
      }
    });
  }, []);

  // "1 USD = 3.65 ILS, 1 EUR = 4.0 ILS" — sent to the model (not shown in chat).
  const formattedRates = rates
    .map((r) => `1 ${r.currency} = ${r.rate} ${TARGET_CURRENCY}`)
    .join(", ");

  /** Validate + attach an image (from the paperclip, paste, or drag-and-drop),
   *  then upload it to storage right away (spinner in the composer chip). */
  async function pickImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("errNotImage"));
      return;
    }
    // Downscale before the size check — big originals often compress under the cap.
    const scaled = await downscaleImage(file);
    if (scaled.size > MAX_IMAGE_BYTES) {
      toast.error(t("errImageTooLarge"));
      return;
    }
    const seq = ++uploadSeq.current;
    setImage(scaled);
    setImageKey(null);
    if (!signUrl) return; // uploads unconfigured — chat still works, save is text-only
    setImageUploading(true);
    const uploaded = await uploadQuoteImage(scaled, signUrl);
    if (seq !== uploadSeq.current) return; // image swapped/cleared while uploading
    setImageUploading(false);
    if (uploaded) setImageKey(uploaded.key);
    else toast.error(t("errImageUpload")); // save falls back to re-uploading
  }

  function clearImage() {
    uploadSeq.current++; // invalidate any in-flight upload completion
    setImage(null);
    setImageKey(null);
    setImageUploading(false);
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
    setSavedIds(new Map());
    setStreaming(false);
    clearImage();
    setSentImage(null); // the screenshot belongs to the conversation it was sent in
    // Exchange rates persist across chats on purpose — they're a session setting.
  }

  async function handleSend(prompt: string) {
    if (streaming || imageUploading) return;
    const newImage = image; // freshly attached this turn (chip in the composer)
    const newImageKey = imageKey; // its already-uploaded storage key (may be null)
    // What the model sees: a new attachment wins; otherwise resend the conversation's
    // image so follow-up turns keep vision context (the API is stateless).
    const file = newImage ?? sentImage;
    const hadImage = Boolean(newImage);

    // The agent's typed prompt is shown as-is; the model receives an augmented
    // copy carrying the active exchange rate so it applies to this and later turns.
    // Wording matches the backend skill's "System notes" rule (quote-skill v4): the
    // USD rate is the sale rate, and the note is excluded from language detection.
    const outgoing = formattedRates
      ? `[System note: the agent's sale exchange rates: ${formattedRates}. Treat the USD rate as the USD→ILS sale rate for all shekel totals; do not ask for a rate. App-injected — ignore for language detection.]\n\n${prompt}`
      : prompt;

    // Multi-turn context = the conversation so far + this new user turn.
    const turns: ChatTurn[] = [
      ...messages
        .filter((m) => m.content.trim())
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: outgoing },
    ];

    setMessages((prev) => [
      ...prev,
      // The turn that ATTACHED the image carries the File (thumbnail) and its
      // uploaded storage key (used verbatim on save); follow-ups reuse the image
      // invisibly via `sentImage`.
      {
        role: "user",
        content: prompt,
        hadImage,
        file: newImage ?? undefined,
        imageKey: newImage ? (newImageKey ?? undefined) : undefined,
        imageMediaType: newImage?.type,
      },
      { role: "assistant", content: "", pending: true },
    ]);
    setStreaming(true);
    if (newImage) setSentImage(newImage); // becomes the conversation's image
    clearImage(); // consumed by this send; the rates stay

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
          : err instanceof AiChatError && err.status === 402
            ? t("errNoCredits")
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
    if (!content.trim() || savedIds.has(index)) return;
    // The nearest preceding user turn is the request that produced this quote. The
    // image, though, may live on an EARLIER turn (follow-ups reuse the conversation's
    // screenshot without re-carrying it) — keep walking back until we find it.
    let prompt = "";
    let hadImage = false;
    let file: File | undefined;
    let storedKey: string | undefined;
    let storedMediaType: string | undefined;
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role !== "user") continue;
      if (!prompt) {
        prompt = messages[i].content;
        hadImage = Boolean(messages[i].hadImage);
      }
      if (messages[i].file) {
        file = messages[i].file;
        storedKey = messages[i].imageKey;
        storedMediaType = messages[i].imageMediaType;
        break;
      }
    }
    if (file) hadImage = true; // the quote was informed by that screenshot

    // The image was uploaded eagerly on attach; reuse its key. If that upload had
    // failed (or predates the eager flow), retry here. A failed upload never blocks
    // saving — we keep the text quote.
    const image = storedKey
      ? { imageKey: storedKey, imageMediaType: storedMediaType ?? file!.type }
      : file && signUrl
        ? await uploadQuoteImage(file, signUrl).then(
            (up) => up && { imageKey: up.key, imageMediaType: up.mediaType },
          )
        : null;

    const result = await saveQuoteAction(content, prompt, hadImage, image || undefined);
    if ("error" in result) {
      toast.error(t(result.error === "empty" ? "errEmpty" : "errForbidden"));
      return;
    }
    setSavedIds((prev) => new Map(prev).set(index, result.id));
    toast.success(t("quoteSaved"));
    router.refresh(); // update the saved-quotes list below the chat
  }

  const composer = (
    <ChatComposer
      disabled={streaming}
      image={image}
      imageUploading={imageUploading}
      onPickImage={pickImage}
      onClearImage={clearImage}
      rates={rates}
      onRatesChange={handleRatesChange}
      onSend={handleSend}
    />
  );

  return (
    <div
      className="relative flex h-[75svh] flex-col overflow-hidden rounded-2xl border border-border bg-surface/40 sm:h-[60svh]"
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
        <div className="flex min-h-0 flex-1 flex-col p-3">
          {/* Scrollable so tall content (stacked cards on mobile, a grown textarea)
              squeezes THIS area instead of clipping the composer out of view. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-h-full flex-col items-center justify-center gap-6 pb-4">
              <ChatEmptyState />
            </div>
          </div>
          <div className="w-full shrink-0">{composer}</div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1">
            <ChatMessages
              messages={messages}
              onSave={handleSaveQuote}
              savedIndexes={new Set(savedIds.keys())}
            />
          </div>
          {/* shrink-0: when the textarea auto-grows (Shift+Enter), the transcript
              shrinks — the composer toolbar must never get clipped. */}
          <div className="shrink-0 border-t border-border bg-card/40 p-3">{composer}</div>
        </>
      )}
    </div>
  );
}
