import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedQuotes } from "@/db/schema";

/**
 * Persistence for **explicitly saved** quotes (the AI chat itself is ephemeral —
 * nothing is written until the agent clicks "Save"). Text only for now; the
 * originating image is attached later via `imageKey` once the R2 backend exists.
 * Every read/write is scoped to the owning user. See docs/ai-quote-assistant-contract.md.
 */

export type SavedQuote = {
  id: number;
  title: string;
  content: string;
  prompt: string;
  imageKey: string | null;
  imageMediaType: string | null;
  createdAt: Date;
};

export type SaveQuoteInput = {
  title: string;
  content: string;
  prompt: string;
  imageKey?: string | null;
  imageMediaType?: string | null;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function tidy(s: string): string {
  return s
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,.;:]+$/, "");
}

/** A "day.month" check-in date from free text ("1.7.26" → "1.7", "12 Aug" → "12.8"). */
function extractDate(text: string): string | null {
  const numeric = text.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-]\d{2,4})?\b/);
  if (numeric) return `${Number(numeric[1])}.${Number(numeric[2])}`;
  const named = text.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
  if (named) return `${Number(named[1])}.${MONTHS.indexOf(named[2].toLowerCase()) + 1}`;
  return null;
}

/** Hotel name + destination, preferring the quote's "Hotel: <name> — <city>" line. */
function extractHotelAndDest(content: string, prompt: string): { hotel: string | null; dest: string | null } {
  let hotel: string | null = null;
  let dest: string | null = null;

  const line = content.match(/hotels?\s*:\s*\**\s*([^\n*]+)/i)?.[1];
  if (line) {
    const parts = tidy(line).split(/\s+[—–-]\s+/);
    hotel = parts[0] || null;
    if (parts.length > 1) dest = parts[parts.length - 1] || null;
  }
  if (!dest) {
    const city = content.match(/(?:city|destination|location)\s*:\s*\**\s*([^\n*,]+)/i)?.[1];
    if (city) dest = tidy(city);
  }
  if (!hotel) {
    const h = prompt.match(/([A-Za-z][\w'’&]+(?:\s+[A-Z][\w'’&]+)*)\s+hotel\b/i)?.[1];
    if (h) hotel = tidy(h);
  }
  if (!dest) {
    const d = prompt.match(/\b(?:to|in|at)\s+([A-Z][a-zA-Z]+)/)?.[1];
    if (d) dest = tidy(d);
  }
  return { hotel, dest };
}

/** Number of travellers from free text. */
function extractPax(text: string): number | null {
  const m = text.match(/\b(\d{1,2})\s*(?:adults?|people|persons?|pax|guests?|travell?ers?)\b/i);
  if (m) return Number(m[1]);
  const f = text.match(/\bfor\s+(\d{1,2})\b/i);
  if (f) return Number(f[1]);
  return null;
}

/**
 * Build the history-list title in the shape `date - destination - hotel - N people`
 * (e.g. "10.7 - Batumi - Sheraton - 2 people"). Best-effort extraction from the
 * generated quote first, then the request; falls back to the cleaned prompt when
 * nothing can be parsed. (The real backend's structured extraction can supply
 * exact fields later.)
 */
export function buildQuoteTitle(prompt: string, content: string): string {
  const date = extractDate(content) ?? extractDate(prompt);
  const { hotel, dest } = extractHotelAndDest(content, prompt);
  const pax = extractPax(content) ?? extractPax(prompt);

  const parts = [date, dest, hotel, pax != null ? `${pax} people` : null].filter(Boolean);
  if (parts.length >= 2) return parts.join(" - ");

  const clean = prompt.replace(/\s+/g, " ").trim();
  if (!clean) return "Saved quote";
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
}

/** The user's saved quotes, newest first, for the history list. */
export async function listSavedQuotes(userId: number): Promise<SavedQuote[]> {
  return db
    .select({
      id: savedQuotes.id,
      title: savedQuotes.title,
      content: savedQuotes.content,
      prompt: savedQuotes.prompt,
      imageKey: savedQuotes.imageKey,
      imageMediaType: savedQuotes.imageMediaType,
      createdAt: savedQuotes.createdAt,
    })
    .from(savedQuotes)
    .where(eq(savedQuotes.userId, userId))
    .orderBy(desc(savedQuotes.createdAt));
}

/** Persist a quote for `userId`; returns its new id. */
export async function saveQuote(userId: number, input: SaveQuoteInput): Promise<number> {
  const [row] = await db
    .insert(savedQuotes)
    .values({
      userId,
      title: input.title,
      content: input.content,
      prompt: input.prompt,
      imageKey: input.imageKey ?? null,
      imageMediaType: input.imageMediaType ?? null,
    })
    .returning({ id: savedQuotes.id });
  return row.id;
}

/** Delete one of the user's saved quotes (ownership-scoped). */
export async function deleteSavedQuote(userId: number, id: number): Promise<void> {
  await db.delete(savedQuotes).where(and(eq(savedQuotes.id, id), eq(savedQuotes.userId, userId)));
}
