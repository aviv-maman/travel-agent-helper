"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BookmarkCheck, BookmarkPlus, Check, Copy, ImageIcon } from "lucide-react";
import { extractFencedBlock } from "@/lib/ai/quote-title";
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
  /** The uploaded image for a user turn, kept in memory so it can be stored to R2
   *  if the resulting quote is saved (the chat itself never uploads). */
  file?: File;
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
  // A completed assistant reply is a quote the user can save to history.
  const canSave = !isUser && !message.pending && message.content.trim().length > 0;

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
            {message.hadImage && (
              <span className="mb-1 flex items-center gap-1.5 text-xs opacity-80">
                <ImageIcon className="size-3.5" />
                {t("imageAttached")}
              </span>
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
