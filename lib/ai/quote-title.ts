/**
 * Pure helpers for titling a saved quote and extracting the forwardable message.
 * No `server-only` / db imports on purpose: shared by the server action, the chat
 * copy button (client), one-off scripts, and unit tests.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Prompts that are just a reply to the assistant ("כן", "ok") — never a usable title. */
const CONFIRMATIONS =
  /^(?:כן|לא|אוקי+|בסדר|סבבה|תודה(?: רבה)?|יאללה|קדימה|yes|no|ok(?:ay)?|sure|thanks?|thank you|go ahead|please)[\s.!]*$/i;

function tidy(s: string): string {
  return s
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,.;:]+$/, "");
}

/**
 * Drop ALL emoji from a title. Flags (regional-indicator pairs) scramble RTL
 * titles on Windows (no flag glyphs → LTR letters "GR"), and the rest are
 * unwanted noise in the saved-quotes list — titles are plain text by design.
 * Covers pictographs, flags, joiners/variation selectors, keycaps, and ★.
 */
function stripEmoji(s: string): string {
  return s
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}\u{2605}\u{2606}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cap a string at `max` characters without splitting surrogate pairs / emoji. */
function capChars(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : s;
}

/** The inner text of the first fenced ``` block (the forwardable WhatsApp message). */
export function extractFencedBlock(content: string): string | null {
  const m = content.match(/```[^\n]*\n([\s\S]*?)```/);
  return m ? m[1].trim() : null;
}

/**
 * The client-facing message to copy / save / forward: the fenced WhatsApp block
 * when present, otherwise the whole reply. This is what strips the internal
 * profit/cost calculations that precede the block — they must never reach the
 * client or a saved quote.
 */
export function forwardableMessage(content: string): string {
  return extractFencedBlock(content) ?? content;
}

/** The first line with real content — skips blanks and fence markers. */
function firstMeaningfulLine(text: string): string | null {
  for (const raw of text.split("\n")) {
    const line = stripEmoji(tidy(raw.replace(/^```.*$/, "")));
    if (line) return line;
  }
  return null;
}

/**
 * The hotel name from a quote, if one exists. Handles the WhatsApp block's
 * house format — a `🏨 המלון שלכם:` / `🏨 מלונות אפשריים:` header with the
 * name on the NEXT line as "[Name] — [4★]" — plus inline "Hotel: X — City" /
 * "מלון: X" lines. Returns the name only (no stars, no city, no emoji).
 */
function extractHotelName(content: string): string | null {
  const lines = content.split("\n");
  const headerAt = lines.findIndex((l) => /(?:המלון שלכם|מלונות אפשריים)\s*:\s*$/.test(l.trim()));
  if (headerAt !== -1) {
    for (const raw of lines.slice(headerAt + 1)) {
      const line = stripEmoji(tidy(raw));
      if (line) return capChars(line.split(/\s+[—–]\s+/)[0].trim(), 40) || null;
    }
  }
  const inline = content.match(/(?:hotels?|מלון)\s*:\s*\**\s*([^\n*]+)/i)?.[1];
  if (inline) {
    const name = stripEmoji(tidy(inline)).split(/\s+[—–-]\s+/)[0].trim();
    return name ? capChars(name, 40) : null;
  }
  return null;
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

/** Number of travellers from free text, rendered in the language it was found in. */
function extractPax(text: string): string | null {
  const he = text.match(/(?:ל-?\s*)?(\d{1,2})\s*נוסעים/);
  if (he) return `${Number(he[1])} נוסעים`;
  const m = text.match(/\b(\d{1,2})\s*(?:adults?|people|persons?|pax|guests?|travell?ers?)\b/i);
  if (m) return `${Number(m[1])} people`;
  const f = text.match(/\bfor\s+(\d{1,2})\b/i);
  if (f) return `${Number(f[1])} people`;
  return null;
}

/**
 * Build the history-list title — plain text (all emoji stripped), with the
 * hotel name appended at the end when the quote names one. A quote with a
 * fenced WhatsApp block titles itself from the block's first line plus
 * date/pax/hotel; other content keeps the legacy `date - destination - N
 * people - hotel` extraction. The prompt is only a last resort — and never
 * when it's a bare confirmation ("כן").
 */
export function buildQuoteTitle(prompt: string, content: string): string {
  const block = extractFencedBlock(content);

  if (block) {
    const titleLine = firstMeaningfulLine(block);
    if (titleLine) {
      const date = extractDate(block) ?? extractDate(content) ?? extractDate(prompt);
      const pax = extractPax(block) ?? extractPax(prompt);
      const hotel = extractHotelName(block);
      // Appended last; skipped when the title line already names the hotel.
      const hotelPart =
        hotel && !titleLine.toLowerCase().includes(hotel.toLowerCase()) ? hotel : null;
      return [capChars(titleLine, 60), date, pax, hotelPart].filter(Boolean).join(" - ");
    }
  }

  const date = extractDate(content) ?? extractDate(prompt);
  const { hotel, dest } = extractHotelAndDest(content, prompt);
  const pax = extractPax(content) ?? extractPax(prompt);

  const parts = [date, dest, pax, hotel && stripEmoji(hotel)].filter(Boolean);
  if (parts.length >= 2) return parts.join(" - ");

  const clean = stripEmoji(prompt.replace(/\s+/g, " ").trim());
  if (clean && clean.length >= 4 && !CONFIRMATIONS.test(clean)) {
    return capChars(clean, 80);
  }
  const contentLine = firstMeaningfulLine(content);
  if (contentLine) return capChars(contentLine, 80);
  return "Saved quote";
}
