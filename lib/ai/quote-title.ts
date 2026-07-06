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
 * Drop flag emojis (regional-indicator pairs). Windows has no flag glyphs, so
 * "🇬🇷" renders as the LTR letters "GR" inside an RTL title and scrambles it.
 */
function stripFlags(s: string): string {
  return s.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "").replace(/\s+/g, " ").trim();
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

/** The first line with real content — skips blanks and fence markers. */
function firstMeaningfulLine(text: string): string | null {
  for (const raw of text.split("\n")) {
    const line = stripFlags(tidy(raw.replace(/^```.*$/, "")));
    if (line) return line;
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
 * Build the history-list title. A quote with a fenced WhatsApp block titles itself
 * from the block's first line (e.g. "חבילת נופש לכרתים 🇬🇷🌿") plus date/pax; other
 * content keeps the legacy `date - destination - hotel - N people` extraction. The
 * prompt is only a last resort — and never when it's a bare confirmation ("כן").
 */
export function buildQuoteTitle(prompt: string, content: string): string {
  const block = extractFencedBlock(content);

  if (block) {
    const titleLine = firstMeaningfulLine(block);
    if (titleLine) {
      const date = extractDate(block) ?? extractDate(content) ?? extractDate(prompt);
      const pax = extractPax(block) ?? extractPax(prompt);
      return [capChars(titleLine, 60), date, pax].filter(Boolean).join(" - ");
    }
  }

  const date = extractDate(content) ?? extractDate(prompt);
  const { hotel, dest } = extractHotelAndDest(content, prompt);
  const pax = extractPax(content) ?? extractPax(prompt);

  const parts = [date, dest, hotel, pax].filter(Boolean);
  if (parts.length >= 2) return parts.join(" - ");

  const clean = prompt.replace(/\s+/g, " ").trim();
  if (clean && clean.length >= 4 && !CONFIRMATIONS.test(clean)) {
    return capChars(clean, 80);
  }
  const contentLine = firstMeaningfulLine(content);
  if (contentLine) return capChars(contentLine, 80);
  return "Saved quote";
}
