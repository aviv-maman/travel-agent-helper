"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BookmarkCheck, BookmarkPlus, Check, Copy, ImageIcon } from "lucide-react";
import { extractFencedBlock } from "@/lib/ai/quote-title";
import { fileUrl } from "@/lib/object-url";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSession } from "@/components/auth/session-provider";
import { UserAvatar } from "@/components/auth/user-avatar";
import { Button } from "@/components/ui/button";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { AssistantBadge } from "./assistant-badge";

export type UiMessage = {
  role: "user" | "assistant";
  content: string;
  hadImage?: boolean;
  pending?: boolean;
  /** The attached image for a user turn: the File renders the thumbnail, and the
   *  storage key/media-type of its eager upload (set on attach) are reused verbatim
   *  when the resulting quote is saved. `imageKey` is undefined if the upload failed
   *  — saving then retries the upload from the File. */
  file?: File;
  imageKey?: string;
  imageMediaType?: string;
};

type T = ReturnType<typeof useTranslations<"ai">>;

/** The scrolling transcript. Auto-scrolls to the newest content as it streams. */
export function ChatMessages({
  messages,
  onSave,
  savedIndexes,
}: {
  messages: UiMessage[];
  onSave: (_index: number) => void;
  savedIndexes: Set<number>;
}) {
  const t = useTranslations("ai");
  const user = useSession();

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end" scrollPreviousItemPeek={64}>
      <MessageScroller>
        <MessageScrollerViewport className="px-4 py-4">
          <MessageScrollerContent className="gap-5">
            {messages.map((message, i) => (
              <MessageScrollerItem
                key={i}
                messageId={String(i)}
                scrollAnchor={message.role === "user"}>
                <MessageItem
                  message={message}
                  t={t}
                  username={user?.username ?? ""}
                  saved={savedIndexes.has(i)}
                  onSave={() => onSave(i)}
                />
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

function MessageItem({
  message,
  t,
  username,
  saved,
  onSave,
}: {
  message: UiMessage;
  t: T;
  username: string;
  saved: boolean;
  onSave: () => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  // Thumbnail of the attached screenshot (kept in memory on the message for storage
  // upload on save). `fileUrl` caches one URL per File for the page's lifetime —
  // see lib/object-url.ts for why we don't create/revoke it here.
  const imageUrl = message.file ? fileUrl(message.file) : null;
  // Copy/Save only apply to a reply carrying the fenced WhatsApp block (the
  // forwardable quote). Clarifying questions and other chatter get no actions.
  const canSave =
    !isUser && !message.pending && extractFencedBlock(message.content) !== null;

  // Copy the forwardable message: the fenced WhatsApp block when there is one,
  // otherwise the whole reply.
  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(extractFencedBlock(message.content) ?? message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context / permissions) — nothing to do.
    }
  }

  return (
    <Message align={isUser ? "end" : "start"}>
      <MessageAvatar className="bg-transparent">
        {isUser ? (
          <UserAvatar name={username || "?"} className="size-8 text-xs" />
        ) : (
          <AssistantBadge />
        )}
      </MessageAvatar>

      <MessageContent>
        <Bubble variant={isUser ? "default" : "muted"}>
          <BubbleContent className="whitespace-pre-wrap">
            {imageUrl ? (
              <button
                type="button"
                onClick={() => setZoomed(true)}
                aria-label={t("enlargeImage")}
                className="mb-1.5 block cursor-zoom-in overflow-hidden rounded-lg border border-border/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={t("imageAttached")}
                  className="max-h-40 max-w-full object-contain transition-transform hover:scale-[1.02]"
                />
              </button>
            ) : (
              message.hadImage && (
                <span className="mb-1 flex items-center gap-1.5 text-xs opacity-80">
                  <ImageIcon className="size-3.5" />
                  {t("imageAttached")}
                </span>
              )
            )}
            {message.pending && !message.content ? (
              <TypingDots />
            ) : (
              <>
                {message.content}
                {message.pending && (
                  <span className="ms-0.5 inline-block h-4 w-[3px] translate-y-0.5 animate-pulse rounded-full bg-current align-baseline" />
                )}
              </>
            )}
          </BubbleContent>
        </Bubble>

        {/* Full-size lightbox for the attached screenshot. */}
        {imageUrl && (
          <Dialog open={zoomed} onOpenChange={setZoomed}>
            <DialogContent className="max-h-[95vh] overflow-auto p-2 sm:max-w-[95vw]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={t("imageAttached")} className="mx-auto max-w-none" />
            </DialogContent>
          </Dialog>
        )}

        {canSave && (
          <MessageFooter>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={copyMessage}>
              {copied ? <Check className="text-success" /> : <Copy />}
              {t("copy")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              disabled={saved}
              onClick={onSave}>
              {saved ? (
                <>
                  <BookmarkCheck className="text-success" />
                  {t("saved")}
                </>
              ) : (
                <>
                  <BookmarkPlus />
                  {t("saveToHistory")}
                </>
              )}
            </Button>
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}

/** Three bouncing dots shown while awaiting the first streamed token. */
function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="…">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </span>
  );
}
