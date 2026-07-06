/**
 * Client-side streaming for the quote chat. Consumes the backend SSE endpoint
 * (`POST /api/ai/chat`, same-origin via the next.config.ts rewrite) as an async
 * generator of text chunks. The backend frames typed SSE events — `delta`
 * (quote text), `tool` (a pricing/lookup tool ran), `error`, `done` — which we
 * parse here; only delta text reaches the UI. When `NEXT_PUBLIC_AI_MOCK==="1"`
 * it yields a canned quote token-by-token so the UI is fully clickable without
 * the backend. Streaming must run in the browser, so this is imported only by
 * Client Components. See docs/ai-quote-assistant-contract.md.
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Mirrors Anthropic error mapping so the UI can show clean messages. */
export class AiChatError extends Error {
  constructor(public status: number) {
    super(`AI chat request failed (${status})`);
    this.name = "AiChatError";
  }
}

/**
 * SSE `error` events arrive mid-stream (HTTP 200 already sent), carrying a code
 * instead of a status. Map them onto the statuses the UI already understands.
 */
const SSE_ERROR_STATUS: Record<string, number> = {
  invalid_key: 401,
  no_credits: 402,
  rate_limit: 429,
};

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

  // Parse the SSE frames: blocks separated by a blank line, each with
  // `event: <name>` and `data: <json>` lines.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = "";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data = line.slice(6);
      }

      if (event === "delta") {
        const text = (JSON.parse(data) as { text?: string }).text;
        if (text) yield text;
      } else if (event === "error") {
        const code = (JSON.parse(data) as { code?: string }).code ?? "";
        throw new AiChatError(SSE_ERROR_STATUS[code] ?? 502);
      } else if (event === "done") {
        return;
      }
      // `tool` events (a backend lookup/pricing tool ran) carry no text — skip.
    }
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
