"use client";

/**
 * Client-side bridge between the saved-quotes history and the chat (siblings on
 * the assistant page, same pattern as ai-enabled-store's window event): when a
 * quote is deleted, the chat must (a) re-enable "Save to history" on the reply
 * that produced it, and (b) forget the message's uploaded imageKey — the delete
 * also freed the storage object, so a re-save must re-upload from the in-memory
 * File instead of persisting a dangling key.
 */

const QUOTE_DELETED_EVENT = "quote-deleted";

export type QuoteDeletedDetail = { id: number; imageKey: string | null };

export function emitQuoteDeleted(detail: QuoteDeletedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<QuoteDeletedDetail>(QUOTE_DELETED_EVENT, { detail }));
}

export function onQuoteDeleted(handler: (_detail: QuoteDeletedDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<QuoteDeletedDetail>).detail);
  window.addEventListener(QUOTE_DELETED_EVENT, listener);
  return () => window.removeEventListener(QUOTE_DELETED_EVENT, listener);
}
