"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { BookmarkCheck, BookmarkPlus, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/auth/session-provider";
import { UserAvatar } from "@/components/auth/user-avatar";
import { Button } from "@/components/ui/button";
import { AssistantBadge } from "./assistant-badge";

export type UiMessage = {
  role: "user" | "assistant";
  content: string;
  hadImage?: boolean;
  pending?: boolean;
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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-1 py-4">
      {messages.map((message, i) => (
        <MessageItem
          key={i}
          message={message}
          t={t}
          username={user?.username ?? ""}
          saved={savedIndexes.has(i)}
          onSave={() => onSave(i)}
        />
      ))}
      <div ref={endRef} />
    </div>
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
  // A completed assistant reply is a quote the user can save to history.
  const canSave = !isUser && !message.pending && message.content.trim().length > 0;

  return (
    <div className={cn("group flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {isUser ? (
        <UserAvatar name={username || "?"} className="mt-0.5 size-8 text-xs" />
      ) : (
        <AssistantBadge className="mt-0.5" />
      )}

      <div className={cn("flex min-w-0 max-w-[82%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "w-fit max-w-full rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm border border-border bg-surface-2 text-foreground",
          )}>
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
        </div>

        {canSave && (
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
        )}
      </div>
    </div>
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
