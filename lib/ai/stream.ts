/**
 * Client-side streaming for the quote chat. Consumes the backend SSE endpoint
 * (`POST /api/ai/chat`, same-origin per docs/backend-overview.md) as an async
 * generator of text chunks. When `NEXT_PUBLIC_AI_MOCK==="1"` (or no backend is
 * wired) it yields a canned quote token-by-token so the UI is fully clickable.
 * Streaming must run in the browser, so this is imported only by Client
 * Components. See docs/ai-quote-assistant-contract.md.
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Mirrors Anthropic error mapping so the UI can show clean messages. */
export class AiChatError extends Error {
  constructor(public status: number) {
    super(`AI chat request failed (${status})`);
    this.name = "AiChatError";
  }
}

const MOCK = process.env.NEXT_PUBLIC_AI_MOCK === "1";

export function isMockMode(): boolean {
  return MOCK;
}

/** Stream the assistant reply for the given turns + optional image. */
export async function* streamAssistant(opts: {
  messages: ChatTurn[];
  image?: File | null;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  if (MOCK) {
    yield* mockStream(opts.messages, opts.image, opts.signal);
    return;
  }

  const form = new FormData();
  form.set("messages", JSON.stringify(opts.messages));
  if (opts.image) form.set("image", opts.image);

  const res = await fetch("/api/ai/chat", { method: "POST", body: form, signal: opts.signal });
  if (!res.ok || !res.body) throw new AiChatError(res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) yield chunk;
  }
}

// --- Local mock -------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function* mockStream(
  messages: ChatTurn[],
  image?: File | null,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const lastPrompt = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const reply = buildMockQuote(lastPrompt, Boolean(image));
  for (const token of reply.match(/\S+\s*|\n/g) ?? []) {
    if (signal?.aborted) return;
    await sleep(22);
    yield token;
  }
}

function buildMockQuote(prompt: string, hadImage: boolean): string {
  const intro = hadImage
    ? "I extracted the offer from your image. Here's a client-ready quote:"
    : "Here's a client-ready quote based on what you shared:";
  return `${intro}

**Hotel:** Sunrise Beach Resort — Antalya
**Dates:** 12 Aug → 19 Aug 2026 (7 nights)
**Board:** All-inclusive
**Room:** Deluxe sea-view, 2 adults

Price breakdown
• Per night: €180
• 7 nights: €1,260
• Transfers (return): €90

**Total: €1,350**

Key conditions
• Free cancellation until 5 Aug 2026
• Prices in EUR, subject to availability at booking

You can forward this to your client as-is. Want me to adjust the markup, switch to a different room, or translate it to Hebrew?

_(demo response — connect the AI backend to get real extractions)_${prompt ? "" : ""}`;
}
